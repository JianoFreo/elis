import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { notFound, dateParam, bizDate } from "../../utils/http.js";
import { text } from "../../utils/domain.js";
import type { ListDispatches, DispatchDetail, Inventory, ProductLedger, ListSupplies, ListUsage, Alerts, OpeningPrefill } from "./dto/get.dto.js";

export async function dispatchRows(date: string | null = null, limit = 5000) {
  return await sql`
    SELECT d.dispatch_code, p.name AS product, b.name AS branch, pb.batch_no, d.quantity_dispatched AS sent,
           d.quantity_received AS received, (d.quantity_received - d.quantity_dispatched) AS variance, d.status,
           d.dispatched_at
      FROM dispatches d JOIN products p ON p.id = d.product_id JOIN branches b ON b.id = d.branch_id
      LEFT JOIN product_batches pb ON pb.id = d.batch_id
     WHERE (${date}::date IS NULL OR (d.dispatched_at AT TIME ZONE 'Asia/Manila')::date = ${date}::date)
     ORDER BY d.dispatched_at DESC, d.id DESC LIMIT ${limit}`;
}

export async function listDispatches(_req: Request, res: Response<ListDispatches.response>) {
  const rows = await dispatchRows(null, 100); // most recent 100; the counts below cover everything
  const [c] = await sql`
    SELECT COUNT(*) FILTER (WHERE status = 'in_transit')::int AS in_transit,
           COUNT(*) FILTER (WHERE status = 'receipt_review')::int AS flags,
           COUNT(*) FILTER (WHERE status IN ('received','receipt_review')
                              AND (received_at AT TIME ZONE 'Asia/Manila')::date = ${dateParam(undefined)}::date)::int AS today
      FROM dispatches`;
  res.json({ in_transit: c.in_transit, received_today: c.today, delivery_flags: c.flags, dispatches: rows });
}

export async function dispatchDetail(req: Request<{ code: string }>, res: Response<DispatchDetail.response>) {
  const [d] = await sql`
    SELECT d.dispatch_code, p.name AS product, p.product_code, b.name AS branch, pb.batch_no, d.quantity_dispatched, d.quantity_received,
           d.status, d.dispatched_at, d.received_at, d.delivery_note, d.receipt_ref,
           pu.full_name AS prepared_by, ru.full_name AS received_by
      FROM dispatches d JOIN products p ON p.id = d.product_id JOIN branches b ON b.id = d.branch_id
      LEFT JOIN product_batches pb ON pb.id = d.batch_id
      LEFT JOIN users pu ON pu.user_id = d.prepared_by LEFT JOIN users ru ON ru.user_id = d.received_by
     WHERE d.dispatch_code = ${req.params.code}`;
  if (!d) throw notFound("Dispatch not found");
  const [disc] = await sql`SELECT disc_code, status FROM discrepancies WHERE source_type = 'delivery' AND source_ref = ${req.params.code} ORDER BY id DESC LIMIT 1`;
  res.json({ dispatch: d, discrepancy: disc ?? null });
}

export async function stockRows(branchId: number | null = null) {
  const rows = await sql`
    WITH grouped AS (
      SELECT p.product_code,p.name AS product,b.name AS location,b.kind,b.id AS location_id,p.id AS product_id,
        pb.batch_no,pb.best_before::text AS best_before,p.threshold,SUM(l.quantity)::int AS qty
      FROM stock_ledger l JOIN products p ON p.id=l.product_id JOIN branches b ON b.id=l.branch_id
      LEFT JOIN product_batches pb ON pb.id=l.batch_id
      WHERE (${branchId}::int IS NULL OR l.branch_id=${branchId}::int)
      GROUP BY p.product_code,p.name,b.name,b.kind,b.id,p.id,pb.batch_no,pb.best_before,p.threshold HAVING SUM(l.quantity)<>0
    ), positions AS (SELECT product_id,branch_id,SUM(quantity)::int AS total FROM stock_ledger GROUP BY product_id,branch_id)
    SELECT g.*,CASE WHEN pos.total<=g.threshold THEN 'Low stock' ELSE 'Healthy' END AS status
      FROM grouped g JOIN positions pos ON pos.product_id=g.product_id AND pos.branch_id=g.location_id
    UNION ALL
    SELECT p.product_code,p.name,b.name,b.kind,b.id,p.id,NULL,NULL,p.threshold,0,'Low stock'
      FROM products p CROSS JOIN branches b WHERE p.active
      AND (${branchId}::int IS NULL OR b.id=${branchId}::int)
      AND ((b.kind='hub' AND NOT EXISTS(SELECT 1 FROM stock_ledger l WHERE l.product_id=p.id AND l.branch_id=b.id))
        OR (EXISTS(SELECT 1 FROM stock_ledger l WHERE l.product_id=p.id AND l.branch_id=b.id)
          AND (SELECT SUM(quantity) FROM stock_ledger l WHERE l.product_id=p.id AND l.branch_id=b.id)=0))
    ORDER BY kind DESC,location_id,product_code,batch_no`;
  return rows as {
    product_code: string;
    product: string;
    location: string;
    kind: string;
    location_id: number;
    product_id: number;
    batch_no: string | null;
    best_before: string | null;
    threshold: number;
    qty: number;
    status: string;
  }[];
}

export async function inventory(_req: Request, res: Response<Inventory.response>) {
  const rows = await stockRows();
  res.json({
    hub_total: rows
      .filter((r) => r.kind === "hub")
      .reduce((s, r) => s + r.qty, 0),
    branch_total: rows
      .filter((r) => r.kind === "branch")
      .reduce((s, r) => s + r.qty, 0),
    low_stock: new Set(
      rows
        .filter((r) => r.status === "Low stock")
        .map((r) => `${r.location_id}:${r.product_code}`),
    ).size,
    rows,
  });
}

export async function productLedger(
  req: Request<{ code: string }>,
  res: Response<ProductLedger.response>,
) {
  const [p] =
    await sql`SELECT id,product_code,name,description,price::float AS price,cost::float AS cost,threshold,active FROM products WHERE product_code=${req.params.code}`;
  if (!p) throw notFound("Product not found");
  const [stock] =
    await sql`SELECT COALESCE(SUM(quantity),0)::int AS qty FROM stock_ledger WHERE product_id=${p.id}`;
  const [batch] =
    await sql`SELECT batch_no,best_before::text AS best_before FROM product_batches WHERE product_id=${p.id} ORDER BY id DESC LIMIT 1`;
  const movements =
    await sql`SELECT l.created_at,l.movement_type,l.quantity,l.reference,b.name AS location,u.full_name AS staff,pb.batch_no
    FROM stock_ledger l JOIN branches b ON b.id=l.branch_id LEFT JOIN users u ON u.user_id=l.recorded_by LEFT JOIN product_batches pb ON pb.id=l.batch_id
    WHERE l.product_id=${p.id} ORDER BY l.created_at DESC,l.id DESC LIMIT 100`;
  res.json({ product: p, on_hand: stock.qty, batch: batch ?? null, movements });
}

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

export async function listSupplies(_req: Request, res: Response<ListSupplies.response>) {
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

export async function listUsage(req: Request, res: Response<ListUsage.response>) {
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

export async function alerts(_req: Request, res: Response<Alerts.response>) {
  res.json(await supplyAlerts());
}

export async function openingPrefill(req: Request, res: Response<OpeningPrefill.response>) {
  const rows = await sql.query(`${MATERIALS_SQL} WHERE m.material_code = $1`, [req.query.material_code ?? ""]);
  if (!rows.length) throw notFound("Material not found");
  res.json({ material_code: rows[0].material_code, unit: rows[0].unit, opening_qty: rows[0].on_hand });
}
