import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { withTx } from "../../utils/tx.js";
import { bad, conflict, dateParam, notFound } from "../../utils/http.js";
import { addLedger, hubId, productByCode, stockOf } from "../../utils/stock.js";
import { logActivity } from "../../utils/activityLogger.js";

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

export async function listDispatches(_req: Request, res: Response) {
  const rows = await dispatchRows(null, 100); // most recent 100; the counts below cover everything
  const [c] = await sql`
    SELECT COUNT(*) FILTER (WHERE status = 'in_transit')::int AS in_transit,
           COUNT(*) FILTER (WHERE status = 'receipt_review')::int AS flags,
           COUNT(*) FILTER (WHERE status IN ('received','receipt_review')
                              AND (received_at AT TIME ZONE 'Asia/Manila')::date = ${dateParam(undefined)}::date)::int AS today
      FROM dispatches`;
  res.json({ in_transit: c.in_transit, received_today: c.today, delivery_flags: c.flags, dispatches: rows });
}

export async function dispatchDetail(req: Request<{ code: string }>, res: Response) {
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

// Saving a dispatch deducts the hub immediately. The branch is credited only when it confirms receipt.
export async function createDispatch(req: Request, res: Response) {
  const { product_code, batch_no, branch_id, quantity } = req.body ?? {};
  const qty = Number(quantity);
  if (!product_code || !Number.isInteger(Number(branch_id)) || !Number.isInteger(qty) || qty <= 0)
    throw bad("product_code, branch_id and a whole quantity above 0 are required");
  const userId = req.user!.user_id;

  const out = await withTx(async (c) => {
    const p = await productByCode(product_code, c);
    const hub = await hubId(c);
    const dest = (await c.query(`SELECT id, kind FROM branches WHERE id = $1`, [Number(branch_id)])).rows[0];
    if (!dest || dest.kind !== "branch") throw bad("Choose a destination branch");
    await c.query(`SELECT pg_advisory_xact_lock($1, $2)`, [hub, p.id]);
    const stock = await stockOf(hub, p.id, c);
    if (qty > stock) throw conflict(`Main hub only has ${stock} ${p.name}`);
    const batch = batch_no
      ? (await c.query(`SELECT id FROM product_batches WHERE product_id = $1 AND batch_no = $2 ORDER BY id DESC LIMIT 1`, [p.id, batch_no])).rows[0]
      : (await c.query(`SELECT id FROM product_batches WHERE product_id = $1 ORDER BY id DESC LIMIT 1`, [p.id])).rows[0];
    if (!batch) throw bad(`Batch ${batch_no ?? ""} not found for ${p.name}`);
    const d = (await c.query(
      `INSERT INTO dispatches (product_id, batch_id, branch_id, quantity_dispatched, status, prepared_by)
       VALUES ($1,$2,$3,$4,'in_transit',$5) RETURNING dispatch_code`, [p.id, batch.id, dest.id, qty, userId])).rows[0];
    await addLedger(c, { product_id: p.id, batch_id: batch.id, branch_id: hub, type: "dispatch_out", qty: -qty, ref: d.dispatch_code, by: userId });
    return { dispatch_code: d.dispatch_code as string, hub_stock_after: stock - qty };
  });
  await logActivity(userId, "dispatch.create", "success", { type: "dispatch", id: out.dispatch_code });
  res.status(201).json(out);
}
