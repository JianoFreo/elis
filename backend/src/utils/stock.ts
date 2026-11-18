import { sql } from "../config/db.js";
import type { Tx } from "./tx.js";
import { bad, notFound } from "./http.js";

type Q = Tx | null;

async function run(q: Q, text: string, params: unknown[]) {
  return q ? (await q.query(text, params)).rows : await sql.query(text, params);
}

export async function productByCode(code: string, q: Q = null) {
  const [p] = await run(q, `SELECT id, product_code, name, price FROM products WHERE product_code = $1`, [code]);
  if (!p) throw notFound(`Product ${code} not found`);
  return p as { id: number; product_code: string; name: string; price: string };
}

export async function hubId(q: Q = null): Promise<number> {
  const [h] = await run(q, `SELECT id FROM branches WHERE kind = 'hub' ORDER BY id LIMIT 1`, []);
  if (!h) throw bad("No main hub is configured");
  return h.id;
}

/** Stock on hand = sum of the append-only ledger. */
export async function stockOf(branchId: number, productId: number, q: Q = null): Promise<number> {
  const [r] = await run(q, `SELECT COALESCE(SUM(quantity),0)::int AS qty FROM stock_ledger WHERE branch_id = $1 AND product_id = $2`, [
    branchId, productId,
  ]);
  return r.qty;
}

/** Latest batch that has stock movements for this product (used to tag branch-level rows). */
export async function latestBatch(productId: number, q: Q = null): Promise<number | null> {
  const [r] = await run(q, `SELECT batch_id FROM stock_ledger WHERE product_id = $1 AND batch_id IS NOT NULL ORDER BY id DESC LIMIT 1`, [
    productId,
  ]);
  return r?.batch_id ?? null;
}

export async function addLedger(
  c: Tx,
  row: { product_id: number; batch_id: number | null; branch_id: number; type: string; qty: number; ref: string | null; by: string | null; at?: string },
) {
  await c.query(
    `INSERT INTO stock_ledger (product_id, batch_id, branch_id, movement_type, quantity, reference, recorded_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::timestamptz, now()))`,
    [row.product_id, row.batch_id, row.branch_id, row.type, row.qty, row.ref, row.by, row.at ?? null],
  );
}
