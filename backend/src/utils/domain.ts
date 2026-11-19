import type { Tx } from "./tx.js";
import { bad, bizDate, conflict, notFound } from "./http.js";
import { addLedger, stockOf } from "./stock.js";

export function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw bad(`${label} is required (maximum ${max} characters)`);
  return value.trim();
}

export function whole(value: unknown, label: string, zero = false): number {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "string" && !value.trim())
  )
    throw bad(`${label} must be a whole number`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < (zero ? 0 : 1) || n > 2147483647)
    throw bad(
      `${label} must be a ${zero ? "nonnegative" : "positive"} whole number`,
    );
  return n;
}

export function amount(value: unknown, label: string): number {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "string" && !value.trim())
  )
    throw bad(`${label} must be zero or more`);
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    n > 99999999.99 ||
    Math.abs(n * 100 - Math.round(n * 100)) > 0.00001
  )
    throw bad(
      `${label} must be a nonnegative amount with at most two decimal places`,
    );
  return n;
}

export function validDate(value: unknown, label = "date"): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw bad(`${label} must be a valid YYYY-MM-DD date`);
  return value;
}

export const requestedDate = (value: unknown) =>
  value === undefined ? bizDate() : validDate(value);
export const manilaDay = (at: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(at),
  );

/** Keep new operations on BUSINESS_DATE during a seeded demonstration. */
export function businessTimestamp(): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return `${bizDate()}T${time}+08:00`;
}

export function saleTimestamp(value: unknown): string {
  if (value === undefined) return businessTimestamp();
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw bad("sold_at must be an ISO timestamp including a timezone");
  validDate(value.slice(0, 10), "sold_at");
  if (manilaDay(value) > bizDate())
    throw bad("A sale cannot be dated after the current business date");
  return new Date(value).toISOString();
}

export async function sellingBranch(c: Tx, branchId: number) {
  const b = (
    await c.query(`SELECT id, name, kind FROM branches WHERE id=$1`, [branchId])
  ).rows[0];
  if (!b || b.kind !== "branch")
    throw bad("Choose a selling branch, not the main hub");
  return b;
}

export async function activeProduct(c: Tx, code: string) {
  const p = (
    await c.query(
      `SELECT id, product_code, name, price, active FROM products WHERE product_code=$1`,
      [code],
    )
  ).rows[0];
  if (!p) throw notFound(`Product ${code} not found`);
  if (!p.active) throw conflict("This product is inactive");
  return p as {
    id: number;
    product_code: string;
    name: string;
    price: string;
    active: boolean;
  };
}

/** All Princess-owned branch writes use this lock before product locks. */
export async function lockBranch(c: Tx, branchId: number) {
  await c.query(`SELECT pg_advisory_xact_lock($1, 0)`, [branchId]);
}

export async function assertDayOpen(c: Tx, branchId: number, date: string) {
  const closing = (
    await c.query(
      `SELECT status FROM daily_closings WHERE branch_id=$1 AND closing_date=$2::date`,
      [branchId, date],
    )
  ).rows[0];
  if (closing && closing.status !== "open")
    throw conflict(
      "This business day's closing is already submitted; an owner must review it before further sales",
    );
  const signed = (
    await c.query(
      `SELECT 1 FROM weekly_audits WHERE status='signed_off' AND $1::date BETWEEN week_start AND week_end`,
      [date],
    )
  ).rows[0];
  if (signed) throw conflict("This sale belongs to an already signed-off week");
}

/** Consume actual branch batches, earliest best-before first, rather than the latest batch at another location. */
export async function postSaleStock(
  c: Tx,
  branchId: number,
  productId: number,
  qty: number,
  ref: string,
  userId: string,
  at: string,
) {
  await c.query(`SELECT pg_advisory_xact_lock($1, $2)`, [branchId, productId]);
  const available = await stockOf(branchId, productId, c);
  if (qty > available)
    throw conflict(`Only ${available} units are in stock at this branch`);
  const batches = (
    await c.query(
      `
    SELECT l.batch_id, SUM(l.quantity)::int AS qty
      FROM stock_ledger l LEFT JOIN product_batches b ON b.id=l.batch_id
     WHERE l.branch_id=$1 AND l.product_id=$2
     GROUP BY l.batch_id, b.best_before HAVING SUM(l.quantity)>0
     ORDER BY b.best_before ASC NULLS LAST, l.batch_id ASC NULLS LAST`,
      [branchId, productId],
    )
  ).rows;
  let remaining = qty;
  for (const b of batches) {
    const take = Math.min(remaining, Number(b.qty));
    if (take > 0)
      await addLedger(c, {
        product_id: productId,
        batch_id: b.batch_id,
        branch_id: branchId,
        type: "sale",
        qty: -take,
        ref,
        by: userId,
        at,
      });
    remaining -= take;
    if (!remaining) break;
  }
  if (remaining) throw conflict("Stock changed; refresh and retry");
  return { stock_before: available, stock_after: available - qty };
}

/** Audit the same transaction as the business write, so a logging failure cannot leave an unreported committed sale. */
export async function activity(
  c: Tx,
  userId: string,
  action: string,
  type: string,
  id: string,
  metadata: Record<string, unknown> = {},
) {
  await c.query(
    `INSERT INTO actions (action_name,module,is_sensitive) VALUES ($1,$2,$3) ON CONFLICT (action_name) DO NOTHING`,
    [action, action.split(".")[0], action === "stock.baseline"],
  );
  await c.query(
    `INSERT INTO activity_logs (user_id,action_id,status,target_type,target_id,metadata)
    SELECT $1,action_id,'success',$3,$4,$5::jsonb FROM actions WHERE action_name=$2`,
    [userId, action, type, id, JSON.stringify(metadata)],
  );
}

/** Stable request references make production and stock receipts safe to retry. */
export async function priorOperation(
  c: Tx,
  key: string,
  userId: string,
  payload: Record<string, unknown>,
) {
  await c.query(`SELECT pg_advisory_xact_lock(hashtext($1), -1)`, [key]);
  const row = (
    await c.query(
      `SELECT user_id, response, payload=$2::jsonb AS same FROM product_stock_requests WHERE operation_key=$1`,
      [key, JSON.stringify(payload)],
    )
  ).rows[0];
  if (!row) return null;
  if (row.user_id !== userId || !row.same)
    throw conflict("This reference was used for a different stock request");
  return { ...row.response, replayed: true };
}

export async function rememberOperation(
  c: Tx,
  key: string,
  userId: string,
  payload: Record<string, unknown>,
  response: Record<string, unknown>,
) {
  await c.query(
    `INSERT INTO product_stock_requests (operation_key,user_id,payload,response) VALUES ($1,$2,$3::jsonb,$4::jsonb)`,
    [key, userId, JSON.stringify(payload), JSON.stringify(response)],
  );
}
