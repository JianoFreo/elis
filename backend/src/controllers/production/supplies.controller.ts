import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { withTx } from "../../utils/tx.js";
import { bad, bizDate, conflict, dateParam, notFound } from "../../utils/http.js";
import { hubId } from "../../utils/stock.js";
import { logActivity } from "../../utils/activityLogger.js";

// On hand = closing count of the latest closed shift + deliveries received after that shift's date.
// (A delivery on the same day as a shift is folded into that shift's record, see stockIn.)
const ON_HAND = `
  COALESCE(last.closing_qty, 0) + COALESCE((
    SELECT SUM(si.quantity) FROM material_stock_in si
     WHERE si.material_id = m.id AND (last.usage_date IS NULL OR si.received_on > last.usage_date)), 0)`;

const MATERIALS_SQL = `
  SELECT m.material_code, m.name, m.category, m.unit, m.cost::float AS cost, m.threshold::float AS threshold,
         m.supplier, m.active, (${ON_HAND})::float AS on_hand
    FROM materials m
    LEFT JOIN LATERAL (
      SELECT usage_date, closing_qty FROM material_usage u
       WHERE u.material_id = m.id AND u.closing_qty IS NOT NULL ORDER BY usage_date DESC, id DESC LIMIT 1) last ON TRUE`;

export interface MaterialRow {
  material_code: string; name: string; category: string | null; unit: string; cost: number; threshold: number;
  supplier: string | null; active: boolean; on_hand: number; status: "Low stock" | "Healthy";
}

export async function materialRows(): Promise<MaterialRow[]> {
  const rows = await sql.query(`${MATERIALS_SQL} WHERE m.active ORDER BY m.material_code`);
  return rows.map((r) => ({ ...(r as Omit<MaterialRow, "status">), status: r.on_hand <= r.threshold ? "Low stock" : "Healthy" }));
}

export interface UsageRow {
  record_ref: string; material_code: string; material: string; unit: string; threshold: number;
  opening: number; received: number; closing: number | null; used: number | null; shift: string; counted_by: string | null;
}

export async function listSupplies(_req: Request, res: Response) {
  const materials = await materialRows();
  const [recv] = await sql`SELECT COUNT(*)::int AS n FROM material_stock_in WHERE received_on = ${bizDate()}::date`;
  res.json({
    registered: materials.length,
    low_stock: materials.filter((m) => m.status === "Low stock").length,
    received_today: recv.n,
    materials,
  });
}

export async function usageRecords(date: string): Promise<UsageRow[]> {
  return (await sql`
    SELECT u.record_ref, m.material_code, m.name AS material, m.unit, m.threshold::float AS threshold,
           u.opening_qty::float AS opening, u.received_qty::float AS received, u.closing_qty::float AS closing, u.used_qty::float AS used,
           u.shift, cu.full_name AS counted_by
      FROM material_usage u JOIN materials m ON m.id = u.material_id LEFT JOIN users cu ON cu.user_id = u.counted_by
     WHERE u.usage_date = ${date}::date ORDER BY m.material_code`) as UsageRow[];
}

export async function listUsage(req: Request, res: Response) {
  res.json({ date: dateParam(req.query.date), records: await usageRecords(dateParam(req.query.date)) });
}

// Alerts: at/below the restock threshold, or >= 95% of the shift's available supply consumed.
export async function supplyAlerts() {
  const [materials, usage] = await Promise.all([materialRows(), usageRecords(bizDate())]);
  const low = materials.filter((m) => m.status === "Low stock");
  const near = usage
    .filter((u) => u.closing !== null && u.opening + u.received > 0 && (u.used ?? 0) / (u.opening + u.received) >= 0.95)
    .map((u) => ({ ...u, pct: Math.round(((u.used ?? 0) / (u.opening + u.received)) * 100) }));
  return { low, near };
}

export async function alerts(_req: Request, res: Response) {
  res.json(await supplyAlerts());
}

export async function openingPrefill(req: Request, res: Response) {
  const rows = await sql.query(`${MATERIALS_SQL} WHERE m.material_code = $1`, [req.query.material_code ?? ""]);
  if (!rows.length) throw notFound("Material not found");
  res.json({ material_code: rows[0].material_code, unit: rows[0].unit, opening_qty: rows[0].on_hand });
}

export async function registerMaterial(req: Request, res: Response) {
  const { name, category = null, unit, cost, threshold, supplier = null } = req.body ?? {};
  if (!name || !unit || Number.isNaN(Number(cost)) || Number.isNaN(Number(threshold))) throw bad("name, unit, cost and threshold are required");
  const [row] = await sql`
    INSERT INTO materials (name, category, unit, cost, threshold, supplier) VALUES (${name}, ${category}, ${unit}, ${Number(cost)}, ${Number(threshold)}, ${supplier})
    RETURNING material_code`;
  await logActivity(req.user!.user_id, "material.update", "success", { type: "material", id: row.material_code });
  res.status(201).json({ message: "Material registered", material_code: row.material_code });
}

export async function updateMaterial(req: Request<{ code: string }>, res: Response) {
  const b = req.body ?? {};
  const rows = await sql`
    UPDATE materials SET name = COALESCE(${b.name ?? null}, name), category = COALESCE(${b.category ?? null}, category),
           unit = COALESCE(${b.unit ?? null}, unit), cost = COALESCE(${b.cost ?? null}, cost),
           threshold = COALESCE(${b.threshold ?? null}, threshold), supplier = COALESCE(${b.supplier ?? null}, supplier), updated_at = now()
     WHERE material_code = ${req.params.code} RETURNING material_code`;
  if (!rows.length) throw notFound("Material not found");
  await logActivity(req.user!.user_id, "material.update", "success", { type: "material", id: req.params.code });
  res.json({ message: "Material saved" });
}

export async function stockIn(req: Request, res: Response) {
  const { material_code, quantity, unit_cost, supplier = null, received_on, receipt_ref = null } = req.body ?? {};
  const qty = Number(quantity);
  if (!material_code || !(qty > 0)) throw bad("material_code and a quantity above 0 are required");
  const userId = req.user!.user_id;
  const day = received_on ? dateParam(received_on) : bizDate();

  const out = await withTx(async (c) => {
    const m = (await c.query(`SELECT id, cost, supplier FROM materials WHERE material_code = $1`, [material_code])).rows[0];
    if (!m) throw notFound("Material not found");
    const ref = receipt_ref ?? `SUP-${String(((await c.query(`SELECT COALESCE(MAX(SUBSTRING(receipt_ref FROM 5)::int),0)+1 AS n FROM material_stock_in WHERE receipt_ref ~ '^SUP-[0-9]+$'`)).rows[0].n as number)).padStart(4, "0")}`;
    const dup = await c.query(`SELECT 1 FROM material_stock_in WHERE receipt_ref = $1`, [ref]);
    if (dup.rowCount) throw conflict(`Receipt ${ref} already exists`);
    await c.query(
      `INSERT INTO material_stock_in (receipt_ref, material_id, quantity, unit_cost, supplier, received_on, received_by) VALUES ($1,$2,$3,$4,$5,$6::date,$7)`,
      [ref, m.id, qty, unit_cost ?? m.cost, supplier ?? m.supplier, day, userId]);
    // same-day shift record: fold the delivery into it so on-hand is not counted twice
    await c.query(
      `UPDATE material_usage SET received_qty = received_qty + $3, closing_qty = CASE WHEN closing_qty IS NULL THEN NULL ELSE closing_qty + $3 END
        WHERE material_id = $1 AND usage_date = $2::date`, [m.id, day, qty]);
    return { receipt_ref: ref };
  });
  await logActivity(userId, "material.stock_in", "success", { type: "material", id: material_code });
  res.status(201).json(out);
}

// Shift opening: prefilled from the previous verified closing, counted by production staff.
export async function logOpening(req: Request, res: Response) {
  const { material_code, opening_qty, shift = "Morning" } = req.body ?? {};
  const open = Number(opening_qty);
  if (!material_code || !(open >= 0) || opening_qty === "" || opening_qty === null || opening_qty === undefined) throw bad("material_code and an opening quantity are required");
  const userId = req.user!.user_id;
  const date = bizDate();
  const out = await withTx(async (c) => {
    const m = (await c.query(`SELECT id, material_code FROM materials WHERE material_code = $1`, [material_code])).rows[0];
    if (!m) throw notFound("Material not found");
    const hub = await hubId(c);
    const ref = `OPEN-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8)}-${m.material_code}`;
    const dup = await c.query(`SELECT 1 FROM material_usage WHERE record_ref = $1`, [ref]);
    if (dup.rowCount) throw conflict("Opening inventory for this material was already logged today");
    // deliveries already received today are part of the physical opening count
    await c.query(
      `INSERT INTO material_usage (record_ref, usage_date, shift, material_id, branch_id, opening_qty, received_qty, counted_by)
       VALUES ($1,$2::date,$3,$4,$5,$6,0,$7)`, [ref, date, shift, m.id, hub, open, userId]);
    return { record_ref: ref, opening_qty: open };
  });
  await logActivity(userId, "usage.record", "success", { type: "material", id: material_code });
  res.status(201).json(out);
}

export async function logClosing(req: Request, res: Response) {
  const { material_code, closing_qty } = req.body ?? {};
  const close = Number(closing_qty);
  if (!material_code || !(close >= 0) || closing_qty === "" || closing_qty === null || closing_qty === undefined) throw bad("material_code and a closing quantity are required");
  const userId = req.user!.user_id;
  const out = await withTx(async (c) => {
    const rec = (await c.query(
      `SELECT u.id, u.opening_qty::float AS opening, u.received_qty::float AS received, u.closing_qty, m.threshold::float AS threshold, m.name, m.unit
         FROM material_usage u JOIN materials m ON m.id = u.material_id
        WHERE m.material_code = $1 AND u.usage_date = $2::date FOR UPDATE OF u`, [material_code, bizDate()])).rows[0];
    if (!rec) throw notFound("Log the shift opening inventory first");
    if (rec.closing_qty !== null) throw conflict("This material was already closed for today");
    const available = rec.opening + rec.received;
    if (close > available) throw bad(`Closing count cannot exceed the ${available} ${rec.unit} available`);
    const used = +(available - close).toFixed(2);
    await c.query(`UPDATE material_usage SET closing_qty = $2, used_qty = $3, closed_by = $4 WHERE id = $1`, [rec.id, close, used, userId]);
    return { material: rec.name as string, unit: rec.unit as string, used, remaining: close, threshold: rec.threshold as number, low: close <= rec.threshold };
  });
  await logActivity(userId, "usage.record", "success", { type: "material", id: material_code });
  res.json(out);
}
