import type { PoolClient } from "@neondatabase/serverless";
import { PRICES, type ProductName } from "./seedData.js";
import type { Plan } from "./seedPlan.js";

export interface Lookups {
  branch: Map<string, number>;
  product: Map<string, number>;
  user: Map<string, string>; // username -> user_id
  material: Map<string, { id: number; code: string }>;
  action: Map<string, number>;
}

/** Multi-row INSERT in chunks. Returns the rows when `returning` is given (in insertion order). */
async function bulk(c: PoolClient, table: string, cols: string[], rows: unknown[][], returning?: string) {
  const out: Record<string, any>[] = [];
  const per = Math.min(500, Math.floor(60000 / cols.length));
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    const params: unknown[] = [];
    const values = chunk.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(",")})`);
    const res = await c.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${values.join(",")}${returning ? ` RETURNING ${returning}` : ""}`, params);
    if (returning) out.push(...res.rows);
  }
  return out;
}

export async function insertPlan(c: PoolClient, plan: Plan, L: Lookups) {
  const B = (n: string) => L.branch.get(n)!;
  const P = (n: string) => L.product.get(n)!;
  const U = (n: string | null) => (n ? L.user.get(n)! : null);
  const owner = U("juan.delacruz");
  const hub = B("Main hub");

  // batches
  const batchRows = await bulk(c, "product_batches", ["batch_no", "product_id", "quantity_produced", "best_before", "production_ref", "recorded_by", "created_at"],
    plan.batches.map((b) => [b.no, P(b.product), b.qty, b.bb, b.ref || null, U("marco.santos"), b.at]), "id");
  const batchId = new Map(plan.batches.map((b, i) => [b.key, batchRows[i].id as number]));

  // ledger
  await bulk(c, "stock_ledger", ["product_id", "batch_id", "branch_id", "movement_type", "quantity", "reference", "recorded_by", "created_at"],
    plan.ledger.map((l) => [P(l.product), batchId.get(l.batchKey)!, B(l.loc), l.type, l.qty, l.ref, U(l.by), l.at]));

  // sales
  await bulk(c, "sales", ["txn_code", "local_ref", "branch_id", "product_id", "quantity", "unit_price", "line_total", "status", "sold_by", "sold_at"],
    plan.sales.map((s) => [s.code, s.localRef, B(s.branch), P(s.product), s.qty, PRICES[s.product as ProductName], PRICES[s.product as ProductName] * s.qty, s.status, U(s.by), s.at]));

  // dispatches
  await bulk(c, "dispatches", ["dispatch_code", "product_id", "batch_id", "branch_id", "quantity_dispatched", "quantity_received", "status", "prepared_by", "dispatched_at", "receipt_ref", "received_by", "received_at", "delivery_note"],
    plan.dispatches.map((d) => [d.code, P(d.product), batchId.get(d.batchKey)!, B(d.branch), d.sent, d.received, d.status, U("marco.santos"), d.at, d.receiptRef, U(d.recvBy), d.recvAt, d.note]));

  // closings + their count lines
  const closingRows = await bulk(c, "daily_closings", ["close_code", "branch_id", "closing_date", "status", "note", "counted_by", "submitted_at", "confirmed_by", "confirmed_at"],
    plan.closings.map((k) => [k.code, B(k.branch), k.date, k.status, k.note, U(k.by), k.submittedAt, k.confirmedAt ? owner : null, k.confirmedAt]), "id");
  const items: unknown[][] = [];
  plan.closings.forEach((k, i) => k.items.forEach((it) => items.push([closingRows[i].id, P(it.product), it.openingReceived, it.sold, it.expected, it.physical, it.physical - it.expected])));
  await bulk(c, "closing_items", ["closing_id", "product_id", "opening_received", "sold", "expected", "physical", "variance"], items);

  // discrepancies, then the adjustments that resolved them
  const discRows = await bulk(c, "discrepancies",
    ["disc_code", "source_type", "source_ref", "branch_id", "product_id", "expected_qty", "actual_qty", "variance", "status", "note", "reason", "created_by", "reviewed_by", "created_at", "resolved_at"],
    plan.discrepancies.map((d) => [d.code, d.type, d.ref, B(d.branch), P(d.product), d.expected, d.actual, d.actual - d.expected, d.status, d.note, d.reason, U(d.createdBy), U(d.reviewedBy), d.createdAt, d.resolvedAt]), "id");
  const discId = new Map(plan.discrepancies.map((d, i) => [d.code, discRows[i].id as number]));
  await bulk(c, "stock_adjustments", ["discrepancy_id", "product_id", "branch_id", "quantity", "reason", "approved_by", "approved_at"],
    plan.adjustments.map((a) => [a.discCode ? discId.get(a.discCode)! : null, P(a.product), B(a.branch), a.qty, a.reason, owner, a.at]));

  // weekly audits
  await bulk(c, "weekly_audits", ["audit_code", "week_start", "week_end", "status", "total_sales", "note", "signed_by", "signed_at"],
    plan.audits.map((a) => [a.code, a.start, a.end, a.status, a.total, a.note, a.status === "signed_off" ? owner : null, a.signedAt]));

  // supplies
  await bulk(c, "material_stock_in", ["receipt_ref", "material_id", "quantity", "unit_cost", "supplier", "received_on", "received_by"],
    plan.stockIns.map((s) => [s.ref, L.material.get(s.material)!.id, s.qty, s.cost, s.supplier, s.on, U("rica.cruz")]));
  await bulk(c, "material_usage", ["record_ref", "usage_date", "shift", "material_id", "branch_id", "opening_qty", "received_qty", "closing_qty", "used_qty", "counted_by", "closed_by"],
    plan.usage.map((u) => {
      const m = L.material.get(u.material)!;
      return [`OPEN-${u.date.slice(2, 4)}${u.date.slice(5, 7)}${u.date.slice(8)}-${m.code}`, u.date, "Morning", m.id, hub, u.opening, u.received, u.closing, u.used, U("rica.cruz"), U("rica.cruz")];
    }));

  // activity trail for the owner decisions in the history
  const logs: unknown[][] = [];
  const act = (name: string) => L.action.get(name)!;
  plan.audits.filter((a) => a.status === "signed_off").forEach((a) => logs.push([owner, act("audit.signoff"), "success", "audit", a.code, a.signedAt]));
  plan.adjustments.forEach((a) => logs.push([owner, act("adjustment.approve"), "success", "discrepancy", a.discCode ?? "manual", a.at]));
  plan.discrepancies.filter((d) => d.type === "delivery" && d.status === "resolved")
    .forEach((d) => logs.push([owner, act("discrepancy.resolve"), "success", "discrepancy", d.code, d.resolvedAt]));
  await bulk(c, "activity_logs", ["user_id", "action_id", "status", "target_type", "target_id", "created_at"], logs);

  // keep generated codes ahead of the seeded ones
  await c.query(`SELECT setval('txn_code_seq', $1)`, [plan.counters.txn]);
  await c.query(`SELECT setval('dispatch_code_seq', $1)`, [plan.counters.dsp]);
  await c.query(`SELECT setval('discrepancy_code_seq', $1)`, [plan.counters.disc]);
}
