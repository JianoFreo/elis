import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { withTx, type Tx } from "../../utils/tx.js";
import { HttpError, bad, branchOf, conflict, notFound, bizDate } from "../../utils/http.js";
import { addLedger } from "../../utils/stock.js";
import { logActivity } from "../../utils/activityLogger.js";
import { activeProduct, activity, assertDayOpen, businessTimestamp, lockBranch, manilaDay, postSaleStock, saleTimestamp, sellingBranch, text, whole } from "../../utils/domain.js";
import { productPosition } from "../../utils/positions.js";
import type { RecordSale, SyncQueue, SubmitClosing, ReceiveDispatch } from "./dto/post.dto.js";

function saleResult(s: Record<string, any>, replayed = false) {
  return {
    status: s.status,
    txn_code: s.txn_code,
    local_ref: s.local_ref,
    line_total: Number(s.line_total),
    product: s.product,
    quantity: s.quantity,
    replayed,
  };
}

async function commitQueued(c: Tx, s: Record<string, any>, userId: string) {
  const p = await activeProduct(c, s.product_code);
  await assertDayOpen(
    c,
    s.branch_id,
    manilaDay(new Date(s.sold_at).toISOString()),
  );
  const row = (
    await c.query(
      `UPDATE sales SET status='synced',txn_code='TXN-'||LPAD(nextval('txn_code_seq')::text,4,'0')
    WHERE id=$1 RETURNING *`,
      [s.id],
    )
  ).rows[0];
  const stock = await postSaleStock(
    c,
    s.branch_id,
    p.id,
    s.quantity,
    row.txn_code,
    userId,
    new Date(s.sold_at).toISOString(),
  );
  return { ...saleResult({ ...row, product: p.name }), ...stock };
}

/** local_ref applies to online AND offline requests, including uncertain network retries. Prices always come from the server. */

export async function recordSale(req: Request, res: Response<RecordSale.response>) {
  const branchId = branchOf(req),
    userId = req.user!.user_id;
  const body = req.body ?? {},
    code = text(body.product_code, "product_code", 255),
    qty = whole(body.quantity, "quantity");
  if (body.offline !== undefined && typeof body.offline !== "boolean")
    throw bad("offline must be true or false");
  const offline = body.offline === true,
    ref =
      body.local_ref === undefined || body.local_ref === null
        ? `L-${randomUUID()}`
        : text(body.local_ref, "local_ref", 40);
  const at = saleTimestamp(body.sold_at);
  const out = await withTx(async (c) => {
    await c.query(`SELECT pg_advisory_xact_lock(hashtext($1),-2)`, [ref]);
    await lockBranch(c, branchId);
    await sellingBranch(c, branchId);
    const old = (
      await c.query(
        `SELECT s.*,p.product_code,p.name AS product FROM sales s JOIN products p ON p.id=s.product_id WHERE local_ref=$1 FOR UPDATE OF s`,
        [ref],
      )
    ).rows[0];
    if (old) {
      if (
        old.branch_id !== branchId ||
        old.sold_by !== userId ||
        old.product_code !== code ||
        old.quantity !== qty ||
        (body.sold_at !== undefined &&
          new Date(old.sold_at).getTime() !== new Date(at).getTime())
      )
        throw conflict("This local reference belongs to a different sale");
      if (old.status === "queued" && !offline) {
        const result = await commitQueued(c, old, userId);
        await activity(c, userId, "sale.sync", "sale", result.txn_code!);
        return result;
      }
      return saleResult(old, true);
    }
    const p = await activeProduct(c, code);
    await assertDayOpen(c, branchId, manilaDay(at));
    const price = Number(p.price),
      total = Math.round(price * qty * 100) / 100;
    if (!Number.isFinite(total) || total > 9999999999.99)
      throw bad("Sale total is too large");
    const s = (
      await c.query(
        `INSERT INTO sales (txn_code,local_ref,branch_id,product_id,quantity,unit_price,line_total,status,sold_by,sold_at)
      VALUES (CASE WHEN $1::boolean THEN NULL ELSE 'TXN-'||LPAD(nextval('txn_code_seq')::text,4,'0') END,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz) RETURNING *`,
        [
          offline,
          ref,
          branchId,
          p.id,
          qty,
          price,
          total,
          offline ? "queued" : "synced",
          userId,
          at,
        ],
      )
    ).rows[0];
    const stock = offline
      ? {}
      : await postSaleStock(c, branchId, p.id, qty, s.txn_code, userId, at);
    await activity(c, userId, "sale.record", "sale", s.txn_code ?? ref, {
      local_ref: ref,
      offline,
    });
    return { ...saleResult({ ...s, product: p.name }), ...stock };
  });
  res.status(out.replayed ? 200 : 201).json(out);
}

export async function syncQueue(req: Request, res: Response<SyncQueue.response>) {
  const branchId = branchOf(req),
    userId = req.user!.user_id;
  const out = await withTx(async (c) => {
    await lockBranch(c, branchId);
    await sellingBranch(c, branchId);
    const queued = (
      await c.query(
        `SELECT s.*,p.product_code FROM sales s JOIN products p ON p.id=s.product_id
      WHERE branch_id=$1 AND status='queued' ORDER BY s.product_id,s.id FOR UPDATE OF s`,
        [branchId],
      )
    ).rows;
    const synced: string[] = [],
      failed: { local_ref: string; reason: string }[] = [];
    for (const s of queued) {
      await c.query("SAVEPOINT sync_sale");
      try {
        const result = await commitQueued(c, s, userId);
        await activity(c, userId, "sale.sync", "sale", result.txn_code!);
        await c.query("RELEASE SAVEPOINT sync_sale");
        synced.push(result.txn_code!);
      } catch (e) {
        await c.query("ROLLBACK TO SAVEPOINT sync_sale");
        await c.query("RELEASE SAVEPOINT sync_sale");
        if (!(e instanceof HttpError)) throw e;
        failed.push({ local_ref: s.local_ref, reason: e.message });
      }
    }
    return { synced, failed, total: queued.length };
  });
  res.json(out);
}

export async function submitClosing(req: Request, res: Response<SubmitClosing.response>) {
  const branchId = branchOf(req),
    date = bizDate(),
    userId = req.user!.user_id;
  const { counts, note = null } = req.body ?? {};
  if (!Array.isArray(counts) || !counts.length) throw bad("counts is required");
  const seen = new Set<string>();
  const submitted = counts.map((x) => {
    if (!x || typeof x !== "object") throw bad("Invalid count row");
    const code = text(x.product_code, "product_code", 255),
      physical = whole(x.physical, "physical", true);
    if (seen.has(code)) throw bad(`Count ${code} exactly once`);
    seen.add(code);
    return { code, physical };
  });
  if (note !== null && (typeof note !== "string" || note.length > 2000))
    throw bad("note must be text up to 2000 characters");
  const at = businessTimestamp();
  const out = await withTx(async (c) => {
    await lockBranch(c, branchId);
    await sellingBranch(c, branchId);
    await assertDayOpen(c, branchId, date);
    const queued = (
      await c.query(
        `SELECT 1 FROM sales WHERE branch_id=$1 AND status='queued'
      AND (sold_at AT TIME ZONE 'Asia/Manila')::date<=$2::date LIMIT 1`,
        [branchId, date],
      )
    ).rows;
    if (queued.length)
      throw conflict("Sync pending sales before submitting the closing");
    const prods = (
      await c.query(`SELECT id FROM products WHERE active ORDER BY id`)
    ).rows;
    for (const p of prods)
      await c.query(`SELECT pg_advisory_xact_lock($1,$2)`, [branchId, p.id]);
    const position = await productPosition(branchId, date, c),
      byCode = new Map(position.map((p) => [p.product_code, p]));
    if (
      submitted.length !== position.length ||
      submitted.some((x) => !byCode.has(x.code))
    )
      throw bad("Count every active product exactly once before submitting");
    const flagged = submitted.filter(
      (x) => x.physical !== byCode.get(x.code)!.expected,
    );
    if (flagged.length && !String(note ?? "").trim())
      throw bad("A supporting note is required when counts differ");
    const existing = (
      await c.query(
        `SELECT id,close_code FROM daily_closings WHERE branch_id=$1 AND closing_date=$2::date FOR UPDATE`,
        [branchId, date],
      )
    ).rows[0];
    const code =
      existing?.close_code ??
      `CLOSE-${date.replace(/-/g, "").slice(2)}-B${branchId}`;
    let closingId: number;
    if (existing) {
      closingId = existing.id;
      await c.query(`DELETE FROM closing_items WHERE closing_id=$1`, [
        closingId,
      ]);
      await c.query(
        `UPDATE daily_closings SET status='submitted',note=$2,counted_by=$3,submitted_at=$4::timestamptz WHERE id=$1`,
        [closingId, note, userId, at],
      );
    } else
      closingId = (
        await c.query(
          `INSERT INTO daily_closings (close_code,branch_id,closing_date,status,note,counted_by,submitted_at)
      VALUES ($1,$2,$3::date,'submitted',$4,$5,$6::timestamptz) RETURNING id`,
          [code, branchId, date, note, userId, at],
        )
      ).rows[0].id;
    for (const x of submitted) {
      const p = byCode.get(x.code)!,
        product = (
          await c.query(`SELECT id FROM products WHERE product_code=$1`, [
            x.code,
          ])
        ).rows[0];
      await c.query(
        `INSERT INTO closing_items (closing_id,product_id,opening_received,sold,expected,physical,variance) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          closingId,
          product.id,
          p.opening_received,
          p.sold,
          p.expected,
          x.physical,
          x.physical - p.expected,
        ],
      );
      if (x.physical !== p.expected)
        await c.query(
          `INSERT INTO discrepancies (source_type,source_ref,branch_id,product_id,expected_qty,actual_qty,variance,status,note,created_by,created_at)
        VALUES ('count',$1,$2,$3,$4,$5,$6,'open',$7,$8,$9::timestamptz)`,
          [
            code,
            branchId,
            product.id,
            p.expected,
            x.physical,
            x.physical - p.expected,
            note,
            userId,
            at,
          ],
        );
    }
    await activity(c, userId, "closing.submit", "closing", code, {
      flagged: flagged.length,
    });
    return { close_code: code, flagged: flagged.length, status: "submitted" };
  });
  res.status(201).json(out);
}

export async function receiveDispatch(
  req: Request<{ code: string }>,
  res: Response<ReceiveDispatch.response>,
) {
  const { quantity_received, delivery_note = null } = req.body ?? {};
  const actual = Number(quantity_received);
  if (!Number.isInteger(actual) || actual < 0)
    throw bad("quantity_received must be a whole number (0 or more)");
  const userId = req.user!.user_id;

  const out = await withTx(async (c) => {
    const d = (
      await c.query(
        `SELECT * FROM dispatches WHERE dispatch_code = $1 FOR UPDATE`,
        [req.params.code],
      )
    ).rows[0];
    if (!d) throw notFound("Dispatch not found");
    if (req.user!.role === "sales-staff" && d.branch_id !== req.user!.branch_id)
      throw new HttpError(403, "This dispatch is for another branch");
    if (d.status !== "in_transit")
      throw conflict("This dispatch was already received");
    if (actual > d.quantity_dispatched)
      throw bad(
        `Received quantity cannot exceed the ${d.quantity_dispatched} dispatched`,
      );
    const receiptRef = `RECV-${d.dispatch_code.replace("DSP-", "")}`;
    const short = actual !== d.quantity_dispatched;
    // branch is credited the ACTUAL quantity once; the hub was already deducted at dispatch
    await addLedger(c, {
      product_id: d.product_id,
      batch_id: d.batch_id,
      branch_id: d.branch_id,
      type: "receipt_in",
      qty: actual,
      ref: receiptRef,
      by: userId,
    });
    await c.query(
      `UPDATE dispatches SET quantity_received=$2, status=$3, receipt_ref=$4, received_by=$5, received_at=now(), delivery_note=$6 WHERE id=$1`,
      [
        d.id,
        actual,
        short ? "receipt_review" : "received",
        receiptRef,
        userId,
        delivery_note,
      ],
    );
    let disc: string | null = null;
    if (short) {
      disc = (
        await c.query(
          `INSERT INTO discrepancies (source_type, source_ref, branch_id, product_id, expected_qty, actual_qty, variance, status, note, created_by)
         VALUES ('delivery',$1,$2,$3,$4,$5,$6,'open',$7,$8) RETURNING disc_code`,
          [
            d.dispatch_code,
            d.branch_id,
            d.product_id,
            d.quantity_dispatched,
            actual,
            actual - d.quantity_dispatched,
            delivery_note,
            userId,
          ],
        )
      ).rows[0].disc_code;
    }
    return {
      dispatch_code: d.dispatch_code as string,
      receipt_ref: receiptRef,
      dispatched: d.quantity_dispatched as number,
      received: actual,
      variance: actual - d.quantity_dispatched,
      discrepancy: disc,
    };
  });
  await logActivity(userId, "receipt.confirm", "success", {
    type: "dispatch",
    id: out.dispatch_code,
  });
  res.json(out);
}
