import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { dateParam, bad } from "../../utils/http.js";
import { sendCsv } from "../../utils/csv.js";
import { productPosition } from "../../utils/positions.js";
import { stockRows } from "../production/getRequests.controller.js";
import { dispatchRows } from "../production/getRequests.controller.js";
import { supplyAlerts, usageRecords, materialRows } from "../production/getRequests.controller.js";

// Each report returns { title, date, summary, rows }. Add ?format=csv to download the rows.
function out(req: Request, res: Response, file: string, body: { title: string; date: string; summary: Record<string, unknown>; rows: Record<string, unknown>[] }) {
  if (req.query.format === "csv") return sendCsv(res, `${file}-${body.date}`, body.rows);
  res.json(body);
}

export async function dailyReport(req: Request, res: Response) {
  const date = dateParam(req.query.date);
  const branchId = Number(req.query.branch_id);
  if (!Number.isInteger(branchId)) throw bad("branch_id is required");
  const [b] = await sql`SELECT name FROM branches WHERE id = ${branchId}`;
  const position = await productPosition(branchId, date);
  const [t] = await sql`
    SELECT COALESCE(SUM(line_total),0)::float AS total, COALESCE(SUM(quantity),0)::int AS items FROM sales
     WHERE branch_id = ${branchId} AND status = 'synced' AND (sold_at AT TIME ZONE 'Asia/Manila')::date = ${date}::date`;
  const [cl] = await sql`SELECT status FROM daily_closings WHERE branch_id = ${branchId} AND closing_date = ${date}::date`;
  out(req, res, "daily-sales", {
    title: "Daily sales & stock summary", date,
    summary: { branch: b?.name, sales_total: t.total, items_sold: t.items, closing_status: cl?.status ?? "not started" },
    rows: position.map((p) => ({
      Product: p.name, "Opening + received": p.opening_received, Sold: p.sold, Expected: p.expected,
      Counted: p.counted ?? "", Variance: p.counted === null ? "" : p.counted - p.expected,
    })),
  });
}

export async function stockReport(req: Request, res: Response) {
  const rows = await stockRows();
  const open = await sql`SELECT disc_code, variance FROM discrepancies WHERE source_type = 'count' AND status <> 'resolved'`;
  out(req, res, "stock-reconciliation", {
    title: "Stock & reconciliation report", date: dateParam(req.query.date),
    summary: {
      hub_total: rows.filter((r) => r.kind === "hub").reduce((s, r) => s + r.qty, 0),
      branch_total: rows.filter((r) => r.kind === "branch").reduce((s, r) => s + r.qty, 0),
      count_variance: open.reduce((s, d) => s + (d.variance as number), 0),
      open_count_flags: open.length,
    },
    rows: rows.map((r) => ({ Product: r.product, Batch: r.batch_no ?? "", Location: r.location, Qty: r.qty, "Best before": r.best_before ?? "", Threshold: r.threshold, Status: r.status })),
  });
}

export async function dispatchReport(req: Request, res: Response) {
  const date = dateParam(req.query.date);
  const rows = await dispatchRows(date);
  out(req, res, "dispatch-status", {
    title: "Dispatch status report", date,
    summary: {
      in_transit: rows.filter((r) => r.status === "in_transit").length,
      confirmed: rows.filter((r) => r.status === "received").length,
      flagged: rows.filter((r) => r.status === "receipt_review").length,
    },
    rows: rows.map((r) => ({ Dispatch: r.dispatch_code, Branch: r.branch, Product: r.product, Batch: r.batch_no ?? "", Sent: r.sent, Received: r.received ?? "", Variance: r.variance ?? "", Status: r.status })),
  });
}

export async function supplyReport(req: Request, res: Response) {
  const date = dateParam(req.query.date);
  const usage = await usageRecords(date);
  const { low } = await supplyAlerts();
  const materials = await materialRows();
  out(req, res, "supply-usage", {
    title: "Supply usage & restock report", date,
    summary: { low_stock: low.length, materials: materials.length },
    rows: usage.map((u) => ({
      Material: u.material, Opening: u.opening, Received: u.received, Used: u.used ?? "", Remaining: u.closing ?? "", Threshold: u.threshold, Unit: u.unit,
    })),
  });
}
