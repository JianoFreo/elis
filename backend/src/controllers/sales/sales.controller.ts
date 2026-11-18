import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { withTx } from "../../utils/tx.js";
import { HttpError, bad, branchOf, conflict, dateParam, notFound, bizDate } from "../../utils/http.js";
import { addLedger, latestBatch, productByCode, stockOf } from "../../utils/stock.js";
import { logActivity } from "../../utils/activityLogger.js";

// ---------------------------------------------------------------------------
// Per-product numbers for one branch and day. Used by the count, the summary and reports.
// expected = what the ledger says is on hand; opening+received = expected + sold today.
// ---------------------------------------------------------------------------
export interface Position {
  product_code: string; name: string; price: number;
  expected: number; sold: number; opening_received: number; counted: number | null;
}

export async function productPosition(branchId: number, date: string): Promise<Position[]> {
  const [rows, counts] = await Promise.all([sql`
    SELECT p.product_code, p.name, p.price::float AS price,
           COALESCE((SELECT SUM(quantity) FROM stock_ledger l WHERE l.branch_id = ${branchId} AND l.product_id = p.id), 0)::int AS expected,
           COALESCE((SELECT SUM(quantity) FROM sales s WHERE s.branch_id = ${branchId} AND s.product_id = p.id
                      AND s.status = 'synced' AND (s.sold_at AT TIME ZONE 'Asia/Manila')::date = ${date}::date), 0)::int AS sold
      FROM products p WHERE p.active ORDER BY p.product_code`,
  sql`
    SELECT p.product_code, ci.physical
      FROM closing_items ci
      JOIN daily_closings dc ON dc.id = ci.closing_id
      JOIN products p ON p.id = ci.product_id
     WHERE dc.branch_id = ${branchId} AND dc.closing_date = ${date}::date`]);
  const physical = new Map(counts.map((c) => [c.product_code, c.physical as number]));
  return rows.map((r) => ({
    product_code: r.product_code as string,
    name: r.name as string,
    price: r.price as number,
    expected: r.expected as number,
    sold: r.sold as number,
    opening_received: (r.expected + r.sold) as number,
    counted: physical.get(r.product_code) ?? null,
  }));
}

async function closingFor(branchId: number, date: string) {
  const [c] = await sql`SELECT close_code, status, note, submitted_at FROM daily_closings WHERE branch_id = ${branchId} AND closing_date = ${date}::date`;
  return c ?? null;
}

export async function workspace(req: Request, res: Response) {
  const branchId = branchOf(req);
  const date = bizDate();
  const [[branch], [tot], [q], position, closing, recent] = await Promise.all([
    sql`SELECT name FROM branches WHERE id = ${branchId}`,
    sql`SELECT COALESCE(SUM(line_total),0)::float AS total, COALESCE(SUM(quantity),0)::int AS items
          FROM sales WHERE branch_id = ${branchId} AND status = 'synced' AND (sold_at AT TIME ZONE 'Asia/Manila')::date = ${date}::date`,
    sql`SELECT COUNT(*)::int AS n FROM sales WHERE branch_id = ${branchId} AND status = 'queued'`,
    productPosition(branchId, date),
    closingFor(branchId, date),
    sql`SELECT s.txn_code, s.local_ref, s.sold_at, p.name AS product, s.quantity, s.line_total::float AS line_total, s.status
          FROM sales s JOIN products p ON p.id = s.product_id
         WHERE s.branch_id = ${branchId} AND (s.sold_at AT TIME ZONE 'Asia/Manila')::date = ${date}::date
         ORDER BY s.sold_at DESC, s.id DESC LIMIT 12`,
  ]);
  if (!branch) throw notFound("Branch not found");
  // 1 = review sales, 2 = count stock, 3 = submit closing
  const step = closing && closing.status !== "open" ? 3 : position.some((p) => p.counted !== null) ? 2 : 1;
  res.json({
    branch: branch.name, branch_id: branchId, date, shift: "Morning · 08:00–16:00",
    sales_total: tot.total, items_sold: tot.items, queued: q.n,
    expected_on_hand: position.reduce((s, p) => s + p.expected, 0),
    closing, step, products: position, recent,
  });
}

// ---------------------------------------------------------------------------
// Record a sale. Online: validated against branch stock and posted to the ledger.
// Offline: kept as 'queued' (no stock effect) until /sync.
// ---------------------------------------------------------------------------
export async function recordSale(req: Request, res: Response) {
  const branchId = branchOf(req);
  const { product_code, quantity, offline = false, local_ref = null } = req.body ?? {};
  const qty = Number(quantity);
  if (!product_code || !Number.isInteger(qty) || qty <= 0) throw bad("product_code and a whole quantity above 0 are required");
  const userId = req.user!.user_id;

  const out = await withTx(async (c) => {
    const p = await productByCode(product_code, c);
    const price = Number(p.price);
    if (offline) {
      const ref = local_ref ?? `LOCAL-${Date.now().toString().slice(-6)}`;
      const dup = await c.query(`SELECT 1 FROM sales WHERE local_ref = $1`, [ref]);
      if (dup.rowCount) throw conflict(`Local reference ${ref} was already recorded`);
      await c.query(
        `INSERT INTO sales (local_ref, branch_id, product_id, quantity, unit_price, line_total, status, sold_by)
         VALUES ($1,$2,$3,$4,$5,$6,'queued',$7)`, [ref, branchId, p.id, qty, price, price * qty, userId]);
      return { status: "queued", txn_code: null as string | null, local_ref: ref, line_total: price * qty, product: p.name, quantity: qty };
    }
    // serialize concurrent sales of the same product at this branch
    await c.query(`SELECT pg_advisory_xact_lock($1, $2)`, [branchId, p.id]);
    const stock = await stockOf(branchId, p.id, c);
    if (qty > stock) throw conflict(`Only ${stock} ${p.name} in stock at this branch`);
    const [row] = (await c.query(
      `INSERT INTO sales (txn_code, branch_id, product_id, quantity, unit_price, line_total, status, sold_by)
       VALUES ('TXN-' || LPAD(nextval('txn_code_seq')::text, 4, '0'), $1,$2,$3,$4,$5,'synced',$6) RETURNING txn_code`,
      [branchId, p.id, qty, price, price * qty, userId])).rows;
    await addLedger(c, { product_id: p.id, batch_id: await latestBatch(p.id, c), branch_id: branchId, type: "sale", qty: -qty, ref: row.txn_code, by: userId });
    return { status: "synced", txn_code: row.txn_code as string | null, local_ref: null as string | null, line_total: price * qty, product: p.name, quantity: qty, stock_before: stock, stock_after: stock - qty };
  });
  await logActivity(userId, "sale.record", "success", { type: "sale", id: (out.txn_code ?? out.local_ref)! });
  res.status(201).json(out);
}

export async function listQueue(req: Request, res: Response) {
  const branchId = branchOf(req);
  const queue = await sql`
    SELECT s.local_ref, p.name AS product, p.product_code, s.quantity, s.line_total::float AS line_total, s.sold_at
      FROM sales s JOIN products p ON p.id = s.product_id
     WHERE s.branch_id = ${branchId} AND s.status = 'queued' ORDER BY s.id`;
  res.json({ queue });
}

// Idempotent: only 'queued' rows are touched, each becomes 'synced' exactly once.
export async function syncQueue(req: Request, res: Response) {
  const branchId = branchOf(req);
  const userId = req.user!.user_id;
  const result = await withTx(async (c) => {
    const queued = (await c.query(
      `SELECT id, product_id, quantity, local_ref FROM sales WHERE branch_id = $1 AND status = 'queued' ORDER BY id FOR UPDATE`, [branchId])).rows;
    const synced: string[] = [];
    const failed: { local_ref: string; reason: string }[] = [];
    for (const s of queued) {
      await c.query(`SELECT pg_advisory_xact_lock($1, $2)`, [branchId, s.product_id]);
      const stock = await stockOf(branchId, s.product_id, c);
      if (s.quantity > stock) { failed.push({ local_ref: s.local_ref, reason: `Only ${stock} in stock` }); continue; }
      const [row] = (await c.query(
        `UPDATE sales SET status = 'synced', txn_code = 'TXN-' || LPAD(nextval('txn_code_seq')::text, 4, '0') WHERE id = $1 RETURNING txn_code`, [s.id])).rows;
      await addLedger(c, { product_id: s.product_id, batch_id: await latestBatch(s.product_id, c), branch_id: branchId, type: "sale", qty: -s.quantity, ref: row.txn_code, by: userId });
      synced.push(row.txn_code);
    }
    return { synced, failed, total: queued.length };
  });
  if (result.synced.length) await logActivity(userId, "sale.sync", "success", { type: "sale", id: result.synced.join(",") });
  res.json(result);
}

export async function listSales(req: Request, res: Response) {
  const branchId = branchOf(req);
  const date = dateParam(req.query.date);
  const sales = await sql`
    SELECT s.txn_code, s.local_ref, s.sold_at, p.name AS product, s.quantity, s.line_total::float AS line_total, s.status, u.full_name AS sold_by
      FROM sales s JOIN products p ON p.id = s.product_id LEFT JOIN users u ON u.user_id = s.sold_by
     WHERE s.branch_id = ${branchId} AND (s.sold_at AT TIME ZONE 'Asia/Manila')::date = ${date}::date ORDER BY s.sold_at DESC, s.id DESC`;
  res.json({ sales });
}

// ---------------------------------------------------------------------------
// Closing
// ---------------------------------------------------------------------------
export async function closingCount(req: Request, res: Response) {
  const branchId = branchOf(req);
  const date = bizDate();
  res.json({ date, closing: await closingFor(branchId, date), products: await productPosition(branchId, date) });
}

export async function submitClosing(req: Request, res: Response) {
  const branchId = branchOf(req);
  const date = bizDate();
  const { counts, note = null } = req.body ?? {};
  if (!Array.isArray(counts) || !counts.length) throw bad("counts is required");
  const userId = req.user!.user_id;

  const out = await withTx(async (c) => {
    const existing = (await c.query(`SELECT id, close_code, status FROM daily_closings WHERE branch_id = $1 AND closing_date = $2::date FOR UPDATE`, [branchId, date])).rows[0];
    if (existing && existing.status !== "open") throw conflict("Today's closing was already submitted");

    const position = await productPosition(branchId, date);
    const byCode = new Map(position.map((p) => [p.product_code, p]));
    const lines = counts.map((x: { product_code: string; physical: number }) => {
      const p = byCode.get(x.product_code);
      const physical = Number(x.physical);
      if (!p || !Number.isInteger(physical) || physical < 0) throw bad(`Invalid count for ${x.product_code}`);
      return { p, physical };
    });
    if (lines.length !== position.length) throw bad("Count every product before submitting");
    const flagged = lines.filter((l) => l.physical !== l.p.expected);
    if (flagged.length && !String(note ?? "").trim()) throw bad("A reason / supporting note is required when counts differ");

    const code = existing?.close_code ?? `CLOSE-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8)}-B${branchId}`;
    let closingId: number;
    if (existing) {
      closingId = existing.id;
      await c.query(`DELETE FROM closing_items WHERE closing_id = $1`, [closingId]);
      await c.query(`UPDATE daily_closings SET status='submitted', note=$2, counted_by=$3, submitted_at=now() WHERE id=$1`, [closingId, note, userId]);
    } else {
      closingId = (await c.query(
        `INSERT INTO daily_closings (close_code, branch_id, closing_date, status, note, counted_by, submitted_at)
         VALUES ($1,$2,$3::date,'submitted',$4,$5,now()) RETURNING id`, [code, branchId, date, note, userId])).rows[0].id;
    }
    for (const { p, physical } of lines) {
      const [prod] = (await c.query(`SELECT id FROM products WHERE product_code = $1`, [p.product_code])).rows;
      await c.query(
        `INSERT INTO closing_items (closing_id, product_id, opening_received, sold, expected, physical, variance) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [closingId, prod.id, p.opening_received, p.sold, p.expected, physical, physical - p.expected]);
      if (physical !== p.expected) {
        await c.query(
          `INSERT INTO discrepancies (source_type, source_ref, branch_id, product_id, expected_qty, actual_qty, variance, status, note, created_by)
           VALUES ('count',$1,$2,$3,$4,$5,$6,'open',$7,$8)`, [code, branchId, prod.id, p.expected, physical, physical - p.expected, note, userId]);
      }
    }
    return { close_code: code, flagged: flagged.length, status: "submitted" };
  });
  await logActivity(userId, "closing.submit", "success", { type: "closing", id: out.close_code });
  res.status(201).json(out);
}

export async function dailySummary(req: Request, res: Response) {
  const branchId = branchOf(req);
  const date = dateParam(req.query.date);
  const products = await productPosition(branchId, date);
  const [tot] = await sql`
    SELECT COALESCE(SUM(line_total),0)::float AS total, COALESCE(SUM(quantity),0)::int AS items
      FROM sales WHERE branch_id = ${branchId} AND status = 'synced' AND (sold_at AT TIME ZONE 'Asia/Manila')::date = ${date}::date`;
  const [flags] = await sql`
    SELECT COUNT(*)::int AS n FROM discrepancies d
     WHERE d.branch_id = ${branchId} AND d.status <> 'resolved' AND (d.created_at AT TIME ZONE 'Asia/Manila')::date = ${date}::date`;
  const closing = await closingFor(branchId, date);
  const [branch] = await sql`SELECT name FROM branches WHERE id = ${branchId}`;
  const variance = products.reduce((s, p) => s + (p.counted === null ? 0 : p.counted - p.expected), 0);
  res.json({ date, branch: branch?.name, sales_total: tot.total, items_sold: tot.items, open_flags: flags.n, closing, variance, products });
}

// ---------------------------------------------------------------------------
// Incoming deliveries for the branch and receipt confirmation
// ---------------------------------------------------------------------------
export async function incomingDispatches(req: Request, res: Response) {
  const branchId = branchOf(req);
  const dispatches = await sql`
    SELECT d.dispatch_code, p.name AS product, pb.batch_no, d.quantity_dispatched, d.dispatched_at, d.status
      FROM dispatches d JOIN products p ON p.id = d.product_id LEFT JOIN product_batches pb ON pb.id = d.batch_id
     WHERE d.branch_id = ${branchId} AND d.status = 'in_transit' ORDER BY d.dispatched_at`;
  res.json({ dispatches });
}

export async function receiveDispatch(req: Request<{ code: string }>, res: Response) {
  const { quantity_received, delivery_note = null } = req.body ?? {};
  const actual = Number(quantity_received);
  if (!Number.isInteger(actual) || actual < 0) throw bad("quantity_received must be a whole number (0 or more)");
  const userId = req.user!.user_id;

  const out = await withTx(async (c) => {
    const d = (await c.query(`SELECT * FROM dispatches WHERE dispatch_code = $1 FOR UPDATE`, [req.params.code])).rows[0];
    if (!d) throw notFound("Dispatch not found");
    if (req.user!.role === "sales-staff" && d.branch_id !== req.user!.branch_id) throw new HttpError(403, "This dispatch is for another branch");
    if (d.status !== "in_transit") throw conflict("This dispatch was already received");
    if (actual > d.quantity_dispatched) throw bad(`Received quantity cannot exceed the ${d.quantity_dispatched} dispatched`);
    const receiptRef = `RECV-${d.dispatch_code.replace("DSP-", "")}`;
    const short = actual !== d.quantity_dispatched;
    // branch is credited the ACTUAL quantity once; the hub was already deducted at dispatch
    await addLedger(c, { product_id: d.product_id, batch_id: d.batch_id, branch_id: d.branch_id, type: "receipt_in", qty: actual, ref: receiptRef, by: userId });
    await c.query(
      `UPDATE dispatches SET quantity_received=$2, status=$3, receipt_ref=$4, received_by=$5, received_at=now(), delivery_note=$6 WHERE id=$1`,
      [d.id, actual, short ? "receipt_review" : "received", receiptRef, userId, delivery_note]);
    let disc: string | null = null;
    if (short) {
      disc = (await c.query(
        `INSERT INTO discrepancies (source_type, source_ref, branch_id, product_id, expected_qty, actual_qty, variance, status, note, created_by)
         VALUES ('delivery',$1,$2,$3,$4,$5,$6,'open',$7,$8) RETURNING disc_code`,
        [d.dispatch_code, d.branch_id, d.product_id, d.quantity_dispatched, actual, actual - d.quantity_dispatched, delivery_note, userId])).rows[0].disc_code;
    }
    return { dispatch_code: d.dispatch_code as string, receipt_ref: receiptRef, dispatched: d.quantity_dispatched as number, received: actual, variance: actual - d.quantity_dispatched, discrepancy: disc };
  });
  await logActivity(userId, "receipt.confirm", "success", { type: "dispatch", id: out.dispatch_code });
  res.json(out);
}
