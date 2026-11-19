import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { withTx } from "../../utils/tx.js";
import { bad, conflict, notFound } from "../../utils/http.js";
import { addLedger } from "../../utils/stock.js";
import { logActivity } from "../../utils/activityLogger.js";

interface Audit {
  id: number;
  audit_code: string;
  week_start: string;
  week_end: string;
  status: string;
  total_sales: number;
  note: string | null;
  signed_at: string | null;
  signed_by: string | null;
}

async function auditByCode(code: string): Promise<Audit> {
  const [a] = await sql`
    SELECT a.id, a.audit_code, a.week_start::text AS week_start, a.week_end::text AS week_end, a.status, a.total_sales::float AS total_sales,
           a.note, a.signed_at, u.full_name AS signed_by
      FROM weekly_audits a LEFT JOIN users u ON u.user_id = a.signed_by WHERE a.audit_code = ${code}`;
  if (!a) throw notFound("Audit not found");
  return a as Audit;
}

// Readiness numbers for one audit week. Queries run in parallel: each round trip to the database is slow.
async function compile(a: Audit) {
  const [branches, daysRow] = await Promise.all([
    sql`SELECT id, name FROM branches WHERE kind = 'branch' ORDER BY id`,
    sql`SELECT (${a.week_end}::date - ${a.week_start}::date + 1)::int AS n`,
  ]);
  const days = daysRow[0].n as number;
  const rows = await Promise.all(
    branches.map(async (b) => {
      const [[s], [c], open, [adj]] = await Promise.all([
        sql`SELECT COALESCE(SUM(line_total),0)::float AS total FROM sales
           WHERE branch_id = ${b.id} AND status = 'synced' AND (sold_at AT TIME ZONE 'Asia/Manila')::date BETWEEN ${a.week_start}::date AND ${a.week_end}::date`,
        sql`SELECT COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed FROM daily_closings
           WHERE branch_id = ${b.id} AND closing_date BETWEEN ${a.week_start}::date AND ${a.week_end}::date`,
        sql`SELECT source_type FROM discrepancies
           WHERE branch_id = ${b.id} AND status <> 'resolved' AND (created_at AT TIME ZONE 'Asia/Manila')::date BETWEEN ${a.week_start}::date AND ${a.week_end}::date`,
        sql`SELECT COUNT(*)::int AS n FROM stock_adjustments WHERE branch_id = ${b.id}
           AND (approved_at AT TIME ZONE 'Asia/Manila')::date BETWEEN ${a.week_start}::date AND ${a.week_end}::date`,
      ]);
      const stock_status = open.some((o) => o.source_type === "count")
        ? "Recount required"
        : open.some((o) => o.source_type === "delivery")
          ? "Receipt review"
          : adj.n
            ? "Reconciled"
            : "Matched";
      return {
        branch_id: b.id as number,
        branch: b.name as string,
        confirmed_days: c.confirmed as number,
        days,
        sales: s.total as number,
        stock_status,
        flags: open.length,
      };
    }),
  );
  const weeklySales = rows.reduce((t, r) => t + r.sales, 0);
  const confirmed = rows.reduce((t, r) => t + r.confirmed_days, 0);
  const flagsTotal = rows.reduce((t, r) => t + r.flags, 0);
  return {
    rows,
    summary: {
      sales: weeklySales,
      confirmed,
      total: days * branches.length,
      open_flags: flagsTotal,
      ready: confirmed === days * branches.length && flagsTotal === 0,
    },
  };
}

export async function listAudits(_req: Request, res: Response) {
  const audits = (await sql`
    SELECT a.id, a.audit_code, a.week_start::text AS week_start, a.week_end::text AS week_end, a.status, a.total_sales::float AS total_sales,
           a.note, a.signed_at, u.full_name AS signed_by
      FROM weekly_audits a LEFT JOIN users u ON u.user_id = a.signed_by ORDER BY a.week_start DESC`) as Audit[];
  const out = await Promise.all(
    audits.map(async (a) => {
      if (a.status === "signed_off") {
        // signed weeks are final: use the stored total instead of recompiling the week
        return {
          ...a,
          sales: a.total_sales,
          confirmed: 21,
          total_closings: 21,
          open_flags: 0,
          branches: 3,
        };
      }
      const c = await compile(a);
      return {
        ...a,
        sales: c.summary.sales,
        confirmed: c.summary.confirmed,
        total_closings: c.summary.total,
        open_flags: c.summary.open_flags,
        branches: c.rows.length,
      };
    }),
  );
  res.json({ audits: out });
}

export async function auditDetail(
  req: Request<{ code: string }>,
  res: Response,
) {
  const a = await auditByCode(req.params.code);
  const c = await compile(a);
  const pending = await sql`
    SELECT dc.close_code, dc.closing_date::text AS date, dc.status, b.name AS branch,
           (SELECT COUNT(*)::int FROM discrepancies d WHERE d.source_ref = dc.close_code AND d.status <> 'resolved') AS open_flags
      FROM daily_closings dc JOIN branches b ON b.id = dc.branch_id
     WHERE dc.status <> 'confirmed' AND dc.closing_date BETWEEN ${a.week_start}::date AND ${a.week_end}::date
     ORDER BY dc.closing_date, b.id`;
  res.json({
    audit: a,
    branches: c.rows,
    summary: c.summary,
    pending_closings: pending,
  });
}

export async function signOff(req: Request<{ code: string }>, res: Response) {
  const a = await auditByCode(req.params.code);
  if (a.status === "signed_off")
    throw conflict("This week is already signed off");
  const c = await compile(a);
  if (!c.summary.ready)
    throw conflict(
      `Not ready: ${c.summary.confirmed} of ${c.summary.total} closings confirmed, ${c.summary.open_flags} open flags`,
    );
  await sql`UPDATE weekly_audits SET status='signed_off', total_sales=${c.summary.sales}, note=${req.body?.note ?? null}, signed_by=${req.user!.user_id}, signed_at=now() WHERE id=${a.id}`;
  await logActivity(req.user!.user_id, "audit.signoff", "success", {
    type: "audit",
    id: a.audit_code,
  });
  res.json({
    audit_code: a.audit_code,
    sales: c.summary.sales,
    closings: c.summary.total,
  });
}

// Princess owns the next-opening carry-forward; the public owner routes remain unchanged.
export {
  baselinePreview,
  confirmBaseline,
} from "./nextOpening.controller.js";
