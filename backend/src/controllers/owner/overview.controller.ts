import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { bizDate } from "../../utils/http.js";
import { supplyAlerts } from "../production/supplies.controller.js";

export async function overview(_req: Request, res: Response) {
  const date = bizDate();
  // each round trip to the database is slow, so run the independent queries together
  const [[today], week, [stock], [transit], flags, { low, near }] = await Promise.all([
    sql`SELECT COALESCE(SUM(line_total),0)::float AS total, COALESCE(SUM(quantity),0)::int AS items
          FROM sales WHERE status = 'synced' AND (sold_at AT TIME ZONE 'Asia/Manila')::date = ${date}::date`,
    sql`SELECT d::date::text AS day, COALESCE(SUM(s.line_total),0)::float AS total
          FROM generate_series(${date}::date - 6, ${date}::date, interval '1 day') d
          LEFT JOIN sales s ON s.status = 'synced' AND (s.sold_at AT TIME ZONE 'Asia/Manila')::date = d::date
         GROUP BY d ORDER BY d`,
    sql`SELECT COALESCE(SUM(quantity),0)::int AS qty, COUNT(DISTINCT branch_id)::int AS locations FROM stock_ledger`,
    sql`SELECT COUNT(*)::int AS n FROM dispatches WHERE status = 'in_transit'`,
    sql`SELECT d.disc_code, d.source_type, b.name AS branch, p.name AS product, d.variance
          FROM discrepancies d JOIN branches b ON b.id = d.branch_id JOIN products p ON p.id = d.product_id
         WHERE d.status <> 'resolved' ORDER BY d.id`,
    supplyAlerts(),
  ]);

  const priorities = [
    ...flags.map((f) => ({
      kind: "flag", ref: f.disc_code as string,
      text: f.source_type === "count"
        ? `${f.branch}: physical count of ${f.product} differs from the expected stock by ${Math.abs(f.variance)}.`
        : `${f.branch}: delivery of ${f.product} is ${Math.abs(f.variance)} short.`,
    })),
    ...low.map((m) => ({ kind: "supply", ref: m.material_code as string, text: `${m.name} is at or below its ${m.threshold} ${m.unit} threshold.` })),
  ];
  res.json({
    date, sales_today: today.total, items_today: today.items,
    available_products: stock.qty, locations: stock.locations,
    in_transit: transit.n, open_flags: flags.length,
    low_supplies: low.length + near.filter((n) => !low.some((l) => l.material_code === n.material_code)).length,
    week, priorities,
  });
}

export async function ownerAlerts(_req: Request, res: Response) {
  res.json(await supplyAlerts());
}
