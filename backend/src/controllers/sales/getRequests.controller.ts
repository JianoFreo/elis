import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { branchOf, notFound, bizDate } from "../../utils/http.js";
import { requestedDate } from "../../utils/domain.js";
import { productPosition, closingFor } from "../../utils/positions.js";
import type { Workspace, ListQueue, ListSales, ClosingCount, DailySummary, IncomingDispatches } from "./dto/get.dto.js";

export async function workspace(req: Request, res: Response<Workspace.response>) {
  const branchId = branchOf(req),
    date = bizDate();
  const [[branch], [tot], [q], position, closing, recent] = await Promise.all([
    sql`SELECT name FROM branches WHERE id=${branchId} AND kind='branch'`,
    sql`SELECT COALESCE(SUM(line_total),0)::float AS total,COALESCE(SUM(quantity),0)::int AS items FROM sales
      WHERE branch_id=${branchId} AND status='synced' AND (sold_at AT TIME ZONE 'Asia/Manila')::date=${date}::date`,
    sql`SELECT COUNT(*)::int AS n FROM sales WHERE branch_id=${branchId} AND status='queued'`,
    productPosition(branchId, date),
    closingFor(branchId, date),
    sql`SELECT s.txn_code,s.local_ref,s.sold_at,p.name AS product,s.quantity,s.line_total::float AS line_total,s.status
      FROM sales s JOIN products p ON p.id=s.product_id WHERE s.branch_id=${branchId}
      AND (s.sold_at AT TIME ZONE 'Asia/Manila')::date=${date}::date ORDER BY s.sold_at DESC,s.id DESC LIMIT 12`,
  ]);
  if (!branch) throw notFound("Selling branch not found");
  const step =
    closing && closing.status !== "open"
      ? 3
      : position.some((p) => p.counted !== null)
        ? 2
        : 1;
  res.json({
    branch: branch.name,
    branch_id: branchId,
    date,
    shift: "Morning · 08:00–16:00",
    sales_total: tot.total,
    items_sold: tot.items,
    queued: q.n,
    expected_on_hand: position.reduce((s, p) => s + p.expected, 0),
    closing,
    step,
    products: position,
    recent,
  });
}

export async function listQueue(req: Request, res: Response<ListQueue.response>) {
  const branchId = branchOf(req);
  const queue =
    await sql`SELECT s.local_ref,p.name AS product,p.product_code,s.quantity,s.line_total::float AS line_total,s.sold_at
    FROM sales s JOIN products p ON p.id=s.product_id WHERE s.branch_id=${branchId} AND s.status='queued' ORDER BY s.id`;
  res.json({ queue });
}

/** Each row uses a savepoint: insufficient stock or closed-day failures retain the entire pending record. */

export async function listSales(req: Request, res: Response<ListSales.response>) {
  const branchId = branchOf(req),
    date = requestedDate(req.query.date);
  const sales =
    await sql`SELECT s.txn_code,s.local_ref,s.sold_at,p.name AS product,s.quantity,s.line_total::float AS line_total,s.status,u.full_name AS sold_by
    FROM sales s JOIN products p ON p.id=s.product_id LEFT JOIN users u ON u.user_id=s.sold_by
    WHERE s.branch_id=${branchId} AND (s.sold_at AT TIME ZONE 'Asia/Manila')::date=${date}::date ORDER BY s.sold_at DESC,s.id DESC`;
  res.json({ sales });
}

export async function closingCount(req: Request, res: Response<ClosingCount.response>) {
  const branchId = branchOf(req),
    date = bizDate();
  res.json({
    date,
    closing: await closingFor(branchId, date),
    products: await productPosition(branchId, date),
  });
}

export async function dailySummary(req: Request, res: Response<DailySummary.response>) {
  const branchId = branchOf(req),
    date = requestedDate(req.query.date),
    products = await productPosition(branchId, date);
  const [tot] =
    await sql`SELECT COALESCE(SUM(line_total),0)::float AS total,COALESCE(SUM(quantity),0)::int AS items FROM sales
    WHERE branch_id=${branchId} AND status='synced' AND (sold_at AT TIME ZONE 'Asia/Manila')::date=${date}::date`;
  const [flags] =
    await sql`SELECT COUNT(*)::int AS n FROM discrepancies WHERE branch_id=${branchId} AND status<>'resolved'
    AND (created_at AT TIME ZONE 'Asia/Manila')::date=${date}::date`;
  const [branch] =
    await sql`SELECT name FROM branches WHERE id=${branchId} AND kind='branch'`;
  if (!branch) throw notFound("Selling branch not found");
  const variance = products.reduce(
    (s, p) => s + (p.counted === null ? 0 : p.counted - p.expected),
    0,
  );
  res.json({
    date,
    branch: branch.name,
    sales_total: tot.total,
    items_sold: tot.items,
    open_flags: flags.n,
    closing: await closingFor(branchId, date),
    variance,
    products,
  });
}

export async function incomingDispatches(req: Request, res: Response<IncomingDispatches.response>) {
  const branchId = branchOf(req);
  const dispatches = await sql`
    SELECT d.dispatch_code, p.name AS product, pb.batch_no, d.quantity_dispatched, d.dispatched_at, d.status
      FROM dispatches d JOIN products p ON p.id = d.product_id LEFT JOIN product_batches pb ON pb.id = d.batch_id
     WHERE d.branch_id = ${branchId} AND d.status = 'in_transit' ORDER BY d.dispatched_at`;
  res.json({ dispatches });
}
