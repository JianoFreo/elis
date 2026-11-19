import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { withTx, type Tx } from "../../utils/tx.js";
import { conflict, notFound } from "../../utils/http.js";
import { addLedger } from "../../utils/stock.js";
import {
  activity,
  lockBranch,
  priorOperation,
  rememberOperation,
  sellingBranch,
  whole,
} from "./domain.js";
async function audit(code: string, c?: Tx) {
  const query = `SELECT id,audit_code,week_start::text,week_end::text,status FROM weekly_audits WHERE audit_code=$1`;
  const rows = c
    ? (await c.query(query, [code])).rows
    : await sql.query(query, [code]);
  if (!rows[0]) throw notFound("Audit not found");
  if (rows[0].status !== "signed_off")
    throw conflict(
      "Sign off the week before preparing the next opening baseline",
    );
  return rows[0];
}
async function snapshot(c: Tx, a: Record<string, any>, branchId: number) {
  const branch = await sellingBranch(c, branchId);
  const rows = (
    await c.query(
      `SELECT p.id,p.product_code,p.name AS product,ci.physical AS qty
    FROM daily_closings dc JOIN closing_items ci ON ci.closing_id=dc.id JOIN products p ON p.id=ci.product_id
    WHERE dc.branch_id=$1 AND dc.closing_date=$2::date AND dc.status='confirmed' ORDER BY p.product_code`,
      [branchId, a.week_end],
    )
  ).rows;
  if (!rows.length)
    throw conflict(
      "A confirmed closing with product counts is required for the final day of this signed week",
    );
  return { branch, rows };
}
export async function baselinePreview(
  req: Request<{ code: string }>,
  res: Response,
) {
  const branchId = whole(req.query.branch_id, "branch_id"),
    a = await audit(req.params.code);
  const out = await withTx((c) => snapshot(c, a, branchId));
  res.json({ audit: a, branch: out.branch.name, products: out.rows });
}
/** Carry forward the signed closing snapshot. A later delivery must not change a signed week's opening values. */
export async function confirmBaseline(
  req: Request<{ code: string }>,
  res: Response,
) {
  const branchId = whole(req.body?.branch_id, "branch_id"),
    userId = req.user!.user_id;
  const out = await withTx(async (c) => {
    const a = await audit(req.params.code, c),
      key = `next:${a.id}:${branchId}`,
      payload = { audit_code: a.audit_code, branch_id: branchId };
    const prior = await priorOperation(c, key, userId, payload);
    if (prior) return prior;
    await lockBranch(c, branchId);
    const { rows } = await snapshot(c, a, branchId);
    const reference = `NEXT-${a.week_end.replace(/-/g, "")}-${a.audit_code}`;
    // Do not create a second marker for a baseline produced by the earlier implementation.
    const old = (
      await c.query(
        `SELECT 1 FROM stock_ledger WHERE reference=$1 AND branch_id=$2 LIMIT 1`,
        [reference, branchId],
      )
    ).rows;
    if (old.length)
      throw conflict(
        "This branch already has a next-opening marker for this signed week",
      );
    for (const p of rows)
      await addLedger(c, {
        product_id: p.id,
        batch_id: null,
        branch_id: branchId,
        type: "opening_baseline",
        qty: 0,
        ref: reference,
        by: userId,
      });
    const response = {
      reference,
      products: rows.length,
      snapshot: rows.map((p) => ({
        product_code: p.product_code,
        quantity: p.qty,
      })),
    };
    await activity(c, userId, "stock.baseline", "audit", a.audit_code, {
      branch_id: branchId,
      snapshot: response.snapshot,
    });
    await rememberOperation(c, key, userId, payload, response);
    return response;
  });
  res.status("replayed" in out ? 200 : 201).json(out);
}
