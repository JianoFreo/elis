import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { withTx } from "../../utils/tx.js";
import { bad, notFound } from "../../utils/http.js";
import { addLedger, hubId, productByCode } from "../../utils/stock.js";
import { logActivity } from "../../utils/activityLogger.js";

// Stock per product / batch / location straight from the ledger.
export async function stockRows(branchId: number | null = null) {
  return (await sql`
    SELECT p.product_code, p.name AS product, b.name AS location, b.kind, pb.batch_no, pb.best_before::text AS best_before,
           p.threshold, SUM(l.quantity)::int AS qty
      FROM stock_ledger l
      JOIN products p ON p.id = l.product_id
      JOIN branches b ON b.id = l.branch_id
      LEFT JOIN product_batches pb ON pb.id = l.batch_id
     WHERE (${branchId}::int IS NULL OR l.branch_id = ${branchId}::int)
     GROUP BY p.product_code, p.name, b.name, b.kind, b.id, pb.batch_no, pb.best_before, p.threshold
    HAVING SUM(l.quantity) <> 0
     ORDER BY b.kind DESC, b.id, p.product_code`).map((r) => ({
    product_code: r.product_code as string, product: r.product as string, location: r.location as string,
    kind: r.kind as string, batch_no: r.batch_no as string | null, best_before: r.best_before as string | null,
    threshold: r.threshold as number, qty: r.qty as number,
    status: (r.qty as number) <= (r.threshold as number) ? "Low stock" : "Healthy",
  }));
}

export async function inventory(_req: Request, res: Response) {
  const rows = await stockRows();
  res.json({
    hub_total: rows.filter((r) => r.kind === "hub").reduce((s, r) => s + r.qty, 0),
    branch_total: rows.filter((r) => r.kind === "branch").reduce((s, r) => s + r.qty, 0),
    low_stock: rows.filter((r) => r.status === "Low stock").length,
    rows,
  });
}

export async function productLedger(req: Request<{ code: string }>, res: Response) {
  const [p] = await sql`SELECT id, product_code, name, description, price::float AS price, cost::float AS cost, threshold, active FROM products WHERE product_code = ${req.params.code}`;
  if (!p) throw notFound("Product not found");
  const [stock] = await sql`SELECT COALESCE(SUM(quantity),0)::int AS qty FROM stock_ledger WHERE product_id = ${p.id}`;
  const [batch] = await sql`SELECT batch_no, best_before::text AS best_before FROM product_batches WHERE product_id = ${p.id} ORDER BY id DESC LIMIT 1`;
  const movements = await sql`
    SELECT l.created_at, l.movement_type, l.quantity, l.reference, b.name AS location, u.full_name AS staff, pb.batch_no
      FROM stock_ledger l JOIN branches b ON b.id = l.branch_id
      LEFT JOIN users u ON u.user_id = l.recorded_by LEFT JOIN product_batches pb ON pb.id = l.batch_id
     WHERE l.product_id = ${p.id} ORDER BY l.created_at DESC, l.id DESC LIMIT 60`;
  res.json({ product: p, on_hand: stock.qty, batch: batch ?? null, movements });
}

// Production output adds completed units to the main hub and records the batch.
export async function recordProduction(req: Request, res: Response) {
  const { product_code, batch_no, quantity, best_before = null } = req.body ?? {};
  const qty = Number(quantity);
  if (!product_code || !batch_no || !Number.isInteger(qty) || qty <= 0) throw bad("product_code, batch_no and a whole quantity above 0 are required");
  const userId = req.user!.user_id;

  const out = await withTx(async (c) => {
    const p = await productByCode(product_code, c);
    const hub = await hubId(c);
    const ref = `PROD-${String(((await c.query(`SELECT COUNT(*)::int AS n FROM product_batches`)).rows[0].n as number) + 1).padStart(3, "0")}`;
    const b = (await c.query(
      `INSERT INTO product_batches (batch_no, product_id, quantity_produced, best_before, production_ref, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [batch_no, p.id, qty, best_before, ref, userId])).rows[0];
    await addLedger(c, { product_id: p.id, batch_id: b.id, branch_id: hub, type: "production_output", qty, ref, by: userId });
    return { production_ref: ref, product: p.name, quantity: qty, batch_no };
  });
  await logActivity(userId, "production.record", "success", { type: "batch", id: `${out.batch_no}` });
  res.status(201).json(out);
}

// Opening baseline for a product / batch / location (a stock movement, never a replacement of history).
export async function stockBaseline(req: Request, res: Response) {
  const { product_code, batch_no, branch_id, quantity, reference = null } = req.body ?? {};
  const qty = Number(quantity);
  if (!product_code || !batch_no || !Number.isInteger(Number(branch_id)) || !Number.isInteger(qty) || qty <= 0)
    throw bad("product_code, batch_no, branch_id and a whole quantity above 0 are required");
  const userId = req.user!.user_id;

  await withTx(async (c) => {
    const p = await productByCode(product_code, c);
    let b = (await c.query(`SELECT id FROM product_batches WHERE product_id = $1 AND batch_no = $2 ORDER BY id DESC LIMIT 1`, [p.id, batch_no])).rows[0];
    if (!b) b = (await c.query(`INSERT INTO product_batches (batch_no, product_id, quantity_produced, recorded_by) VALUES ($1,$2,0,$3) RETURNING id`, [batch_no, p.id, userId])).rows[0];
    await addLedger(c, { product_id: p.id, batch_id: b.id, branch_id: Number(branch_id), type: "opening_baseline", qty, ref: reference ?? `BASE-${batch_no}`, by: userId });
  });
  await logActivity(userId, "stock.baseline", "success", { type: "product", id: product_code });
  res.status(201).json({ message: "Stock movement saved" });
}

// Product master edit for the production head (price/threshold/description + latest batch best-before).
export async function updateProductMaster(req: Request<{ code: string }>, res: Response) {
  const b = req.body ?? {};
  const rows = await sql`
    UPDATE products SET
      name = COALESCE(${b.name ?? null}, name),
      description = COALESCE(${b.description ?? null}, description),
      price = COALESCE(${b.price ?? null}, price),
      threshold = COALESCE(${b.threshold ?? null}, threshold),
      updated_at = now()
     WHERE product_code = ${req.params.code} RETURNING id`;
  if (!rows.length) throw notFound("Product not found");
  if (b.best_before) {
    await sql`UPDATE product_batches SET best_before = ${b.best_before}::date
               WHERE id = (SELECT id FROM product_batches WHERE product_id = ${rows[0].id} ORDER BY id DESC LIMIT 1)`;
  }
  await logActivity(req.user!.user_id, "product.update", "success", { type: "product", id: req.params.code });
  res.json({ message: "Product saved" });
}
