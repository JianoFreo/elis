import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { withTx } from "../../utils/tx.js";
import { bad, bizDate, conflict, notFound } from "../../utils/http.js";
import { addLedger, latestBatch } from "../../utils/stock.js";
import { logActivity } from "../../utils/activityLogger.js";

const BASE = `
  SELECT d.disc_code, d.source_type, d.source_ref, d.status, d.expected_qty, d.actual_qty, d.variance, d.note, d.reason,
         d.created_at, d.resolved_at, b.name AS branch, p.name AS product, p.product_code,
         cu.full_name AS created_by, ru.full_name AS reviewed_by
    FROM discrepancies d
    JOIN branches b ON b.id = d.branch_id JOIN products p ON p.id = d.product_id
    LEFT JOIN users cu ON cu.user_id = d.created_by LEFT JOIN users ru ON ru.user_id = d.reviewed_by`;

export async function listDiscrepancies(_req: Request, res: Response) {
  const rows = await sql.query(`${BASE} ORDER BY d.id DESC`);
  const [adj] = await sql`
    SELECT COUNT(*)::int AS n FROM stock_adjustments
     WHERE (approved_at AT TIME ZONE 'Asia/Manila')::date BETWEEN ${bizDate()}::date - 6 AND ${bizDate()}::date`;
  res.json({
    open_flags: rows.filter((r) => r.status !== "resolved").length,
    open_counts: rows.filter((r) => r.status !== "resolved" && r.source_type === "count").length,
    open_deliveries: rows.filter((r) => r.status !== "resolved" && r.source_type === "delivery").length,
    adjustments_this_week: adj.n,
    awaiting_recount: rows.filter((r) => r.status === "recount").length,
    discrepancies: rows,
  });
}

export async function discrepancyDetail(req: Request<{ code: string }>, res: Response) {
  const [d] = await sql.query(`${BASE} WHERE d.disc_code = $1`, [req.params.code]);
  if (!d) throw notFound("Discrepancy not found");
  let dispatch = null;
  if (d.source_type === "delivery") {
    [dispatch] = await sql`
      SELECT d.dispatch_code, d.receipt_ref, d.quantity_dispatched, d.quantity_received, d.received_at, d.delivery_note,
             pb.batch_no, ru.full_name AS received_by
        FROM dispatches d LEFT JOIN product_batches pb ON pb.id = d.batch_id LEFT JOIN users ru ON ru.user_id = d.received_by
       WHERE d.dispatch_code = ${d.source_ref}`;
  }
  res.json({ discrepancy: d, dispatch: dispatch ?? null });
}

export async function requestRecount(req: Request<{ code: string }>, res: Response) {
  const rows = await sql`UPDATE discrepancies SET status = 'recount' WHERE disc_code = ${req.params.code} AND status = 'open' RETURNING disc_code`;
  if (!rows.length) throw conflict("Only open discrepancies can be sent back for a recount");
  res.json({ message: "Recount requested. The ledger is unchanged." });
}

// Only an owner-approved adjustment changes the reconciled ledger.
export async function approveAdjustment(req: Request<{ code: string }>, res: Response) {
  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) throw bad("A reason is required");
  const userId = req.user!.user_id;

  const out = await withTx(async (c) => {
    const d = (await c.query(`SELECT * FROM discrepancies WHERE disc_code = $1 FOR UPDATE`, [req.params.code])).rows[0];
    if (!d) throw notFound("Discrepancy not found");
    if (d.source_type !== "count") throw bad("Delivery discrepancies are resolved, not adjusted");
    if (d.status === "resolved") throw conflict("Already resolved");
    await c.query(
      `INSERT INTO stock_adjustments (discrepancy_id, product_id, branch_id, quantity, reason, approved_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [d.id, d.product_id, d.branch_id, d.variance, reason, userId]);
    await addLedger(c, { product_id: d.product_id, batch_id: await latestBatch(d.product_id, c), branch_id: d.branch_id, type: "adjustment", qty: d.variance, ref: d.disc_code, by: userId });
    await c.query(`UPDATE discrepancies SET status='resolved', reason=$2, reviewed_by=$3, resolved_at=now() WHERE id=$1`, [d.id, reason, userId]);
    // a closing with nothing left to resolve is confirmed
    await c.query(
      `UPDATE daily_closings SET status='confirmed', confirmed_by=$2, confirmed_at=now()
        WHERE close_code = $1 AND status='submitted'
          AND NOT EXISTS (SELECT 1 FROM discrepancies x WHERE x.source_ref = $1 AND x.status <> 'resolved')`, [d.source_ref, userId]);
    const [stock] = (await c.query(`SELECT COALESCE(SUM(quantity),0)::int AS qty FROM stock_ledger WHERE branch_id=$1 AND product_id=$2`, [d.branch_id, d.product_id])).rows;
    return { disc_code: d.disc_code as string, adjustment: d.variance as number, stock_after: stock.qty as number };
  });
  await logActivity(userId, "adjustment.approve", "success", { type: "discrepancy", id: out.disc_code }, { reason });
  res.json(out);
}

// Delivery shortage: record the owner's decision. The branch keeps the actual credit; nothing is added or deducted again.
export async function resolveDelivery(req: Request<{ code: string }>, res: Response) {
  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) throw bad("A reason is required");
  const userId = req.user!.user_id;
  const out = await withTx(async (c) => {
    const d = (await c.query(`SELECT * FROM discrepancies WHERE disc_code = $1 FOR UPDATE`, [req.params.code])).rows[0];
    if (!d) throw notFound("Discrepancy not found");
    if (d.source_type !== "delivery") throw bad("Only delivery discrepancies are resolved this way");
    if (d.status === "resolved") throw conflict("Already resolved");
    await c.query(`UPDATE discrepancies SET status='resolved', reason=$2, reviewed_by=$3, resolved_at=now() WHERE id=$1`, [d.id, reason, userId]);
    await c.query(`UPDATE dispatches SET status='received' WHERE dispatch_code = $1`, [d.source_ref]);
    return { disc_code: d.disc_code as string, dispatch_code: d.source_ref as string };
  });
  await logActivity(userId, "discrepancy.resolve", "success", { type: "discrepancy", id: out.disc_code }, { reason });
  res.json(out);
}

export async function confirmClosing(req: Request<{ code: string }>, res: Response) {
  const [open] = await sql`SELECT COUNT(*)::int AS n FROM discrepancies WHERE source_ref = ${req.params.code} AND status <> 'resolved'`;
  if (open.n) throw conflict("Resolve the open discrepancies for this closing first");
  const rows = await sql`
    UPDATE daily_closings SET status='confirmed', confirmed_by=${req.user!.user_id}, confirmed_at=now()
     WHERE close_code = ${req.params.code} AND status = 'submitted' RETURNING close_code`;
  if (!rows.length) throw conflict("Only a submitted closing can be confirmed");
  res.json({ message: "Closing confirmed" });
}
