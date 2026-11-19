import { sql } from "../config/db.js";
import type { Tx } from "./tx.js";

export interface Position {
  product_code: string;
  name: string;
  price: number;
  expected: number;
  sold: number;
  opening_received: number;
  counted: number | null;
  adjustments: number;
  outgoing: number;
}

/** Day-bounded ledger figures; submitted closing items remain frozen after later sales / adjustments. */
export async function productPosition(
  branchId: number,
  date: string,
  client?: Tx,
): Promise<Position[]> {
  const query = `
    WITH position AS (
      SELECT product_id,
        COALESCE(SUM(quantity) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Manila')::date <= $2::date),0)::int AS expected,
        COALESCE(SUM(quantity) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Manila')::date < $2::date),0)::int AS opening,
        COALESCE(SUM(quantity) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Manila')::date=$2::date AND movement_type IN ('opening_baseline','receipt_in','production_output')),0)::int AS received,
        COALESCE(SUM(quantity) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Manila')::date=$2::date AND movement_type='adjustment'),0)::int AS adjustments,
        -COALESCE(SUM(quantity) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Manila')::date=$2::date AND movement_type='dispatch_out'),0)::int AS outgoing
      FROM stock_ledger WHERE branch_id=$1 GROUP BY product_id
    ), sold AS (
      SELECT product_id,SUM(quantity)::int AS qty FROM sales
      WHERE branch_id=$1 AND status='synced' AND (sold_at AT TIME ZONE 'Asia/Manila')::date=$2::date GROUP BY product_id
    ), snapshot AS (
      SELECT ci.* FROM closing_items ci JOIN daily_closings dc ON dc.id=ci.closing_id
      WHERE dc.branch_id=$1 AND dc.closing_date=$2::date AND dc.status<>'open'
    )
    SELECT p.product_code,p.name,p.price::float AS price,
      COALESCE(snap.expected,pos.expected,0)::int AS expected,
      COALESCE(snap.sold,s.qty,0)::int AS sold,
      COALESCE(snap.opening_received,COALESCE(pos.opening,0)+COALESCE(pos.received,0))::int AS opening_received,
      snap.physical AS counted,COALESCE(pos.adjustments,0)::int AS adjustments,COALESCE(pos.outgoing,0)::int AS outgoing
    FROM products p LEFT JOIN position pos ON pos.product_id=p.id
      LEFT JOIN sold s ON s.product_id=p.id LEFT JOIN snapshot snap ON snap.product_id=p.id
    WHERE p.active OR snap.product_id IS NOT NULL ORDER BY p.product_code`;
  const rows = client
    ? (await client.query(query, [branchId, date])).rows
    : await sql.query(query, [branchId, date]);
  return rows as Position[];
}

export async function closingFor(branchId: number, date: string) {
  const [c] =
    await sql`SELECT close_code,status,note,submitted_at FROM daily_closings WHERE branch_id=${branchId} AND closing_date=${date}::date`;
  return c ?? null;
}
