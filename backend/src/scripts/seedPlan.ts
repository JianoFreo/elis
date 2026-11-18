// Builds a deterministic "system that is over a year old" data set. Pure: no database access.
//
// Shape of the data:
//  - 06 Oct 2025 .. 07 Nov 2026 is generated history (daily sales, dispatches, receipts, closings,
//    material usage, discrepancies, weekly audits). The last week (02-08 Nov 2026) follows the Figma prototype.
//  - Stock is built so every (location, product) balance is constant across the history:
//    receipts cover sales, adjustments are compensated the same morning, production covers dispatches.
//    That makes the ledger add up exactly to the figures on the 08 Nov screens.
import {
  BRANCHES, BRANCH_STAFF, DAILY_SALES, MAIN_STREET_NOV8, PRICES, PRODUCT_NAMES, splitTotal,
  type BranchName, type ProductName,
} from "./seedData.js";

export const HISTORY_START = "2025-10-06"; // a Monday
export const LAST_HISTORY_DAY = "2026-11-07";
export const NOV8 = "2026-11-08";
const FINAL_WEEK_START = "2026-11-02";
const W44_TOTAL = 88300; // signed week 26 Oct - 01 Nov, from the prototype

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
export const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dow = (s: string) => (new Date(`${s}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const at = (d: string, t: string) => `${d} ${t}:00+08`;
const pad = (n: number, w: number) => String(n).padStart(w, "0");
const mmdd = (d: string) => d.slice(5, 7) + d.slice(8);

function isoWeek(d: string): { year: number; week: number } {
  const t = new Date(`${d}T00:00:00Z`);
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3); // Thursday of this week
  const year = t.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((t.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return { year, week };
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round5 = (n: number) => Math.round(n / 5) * 5;
const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------
export interface LedgerRow { product: string; batchKey: string; loc: string; type: string; qty: number; ref: string; by: string | null; at: string }
export interface Plan {
  batches: { key: string; no: string; product: string; qty: number; bb: string; ref: string; at: string }[];
  ledger: LedgerRow[];
  sales: { code: string | null; localRef: string | null; branch: string; product: ProductName; qty: number; status: "synced" | "queued"; by: string; at: string }[];
  dispatches: { code: string; product: string; batchKey: string; branch: string; sent: number; received: number | null; status: string; at: string; recvAt: string | null; recvBy: string | null; note: string | null; receiptRef: string | null }[];
  closings: { code: string; branch: string; date: string; status: string; note: string | null; by: string; submittedAt: string | null; confirmedAt: string | null; items: { product: string; openingReceived: number; sold: number; expected: number; physical: number }[] }[];
  discrepancies: { code: string; type: "count" | "delivery"; ref: string; branch: string; product: string; expected: number; actual: number; status: string; note: string | null; reason: string | null; createdBy: string; reviewedBy: string | null; createdAt: string; resolvedAt: string | null }[];
  adjustments: { discCode: string | null; branch: string; product: string; qty: number; reason: string; at: string }[];
  audits: { code: string; start: string; end: string; status: "signed_off" | "in_review"; total: number; note: string | null; signedAt: string | null }[];
  stockIns: { ref: string; material: string; qty: number; cost: number; supplier: string; on: string }[];
  usage: { date: string; material: string; opening: number; received: number; closing: number; used: number }[];
  counters: { txn: number; dsp: number; disc: number };
}

export const MATERIAL_SPEC = [
  { name: "All-purpose flour", rate: 11, thr: 10, supplier: "Local Milling Co.", cost: 55, o8: 20, c8: 8 },
  { name: "White sugar", rate: 5, thr: 2, supplier: "Local Milling Co.", cost: 65, o8: 20, c8: 0.8 },
  { name: "Butter", rate: 4, thr: 5, supplier: "Dairy Supply Co.", cost: 220, o8: 16, c8: 12 },
  { name: "Chicken filling", rate: 5, thr: 8, supplier: "Fresh Market", cost: 180, o8: 22, c8: 18 },
  { name: "Cheese blend", rate: 3, thr: 4, supplier: "Dairy Supply Co.", cost: 240, o8: 15, c8: 11.5 },
  { name: "Ripe bananas", rate: 7, thr: 6, supplier: "Fresh Market", cost: 60, o8: 30, c8: 22 },
  { name: "Cooking oil", rate: 2, thr: 3, supplier: "Fresh Market", cost: 110, o8: 12, c8: 9.5 },
  { name: "Eggs", rate: 2.5, thr: 2, supplier: "Fresh Market", cost: 210, o8: 10, c8: 7 },
] as const;

const COUNT_REASONS = ["Damaged during display", "Spoilage", "Miscount found on recount", "Given away as samples", "Extra unit found on recount"];
const SHELF_DAYS: Record<string, number> = { "Chicken empanada": 2, "Cheese roll": 4, "Banana loaf": 4 };
const BASE_REV: Record<BranchName, number> = { "Main Street": 4900, "Market Road": 4450, "Town Center": 3530 };
const TAG: Record<BranchName, string> = { "Main Street": "MS", "Market Road": "MR", "Town Center": "TC" };
const DOW_FACTOR = [0.86, 0.9, 0.92, 1.0, 1.18, 1.14, 1.0];

// ---------------------------------------------------------------------------
export function buildPlan(): Plan {
  const rnd = rng(20261108);
  const plan: Plan = {
    batches: [], ledger: [], sales: [], dispatches: [], closings: [], discrepancies: [], adjustments: [],
    audits: [], stockIns: [], usage: [], counters: { txn: 0, dsp: 0, disc: 0 },
  };
  const days: string[] = [];
  for (let d = HISTORY_START; d <= LAST_HISTORY_DAY; d = addDays(d, 1)) days.push(d);

  // ---- revenue per branch per day ----
  const rev = new Map<string, number>();
  const key = (b: string, d: string) => `${b}|${d}`;
  days.forEach((d, i) => {
    const t = i / (days.length - 1);
    const m = Number(d.slice(5, 7));
    const season = m === 12 ? 1.18 : m === 1 ? 0.94 : m === 4 || m === 5 ? 1.06 : 1;
    for (const b of BRANCHES) rev.set(key(b, d), Math.max(1500, round5(BASE_REV[b] * (0.66 + 0.34 * t) * season * DOW_FACTOR[dow(d)] * (0.9 + 0.2 * rnd()))));
  });
  // final week = prototype totals
  BRANCHES.forEach((b) => DAILY_SALES[b].slice(0, 6).forEach((v, i) => rev.set(key(b, addDays(FINAL_WEEK_START, i)), v)));
  // week before it must total 88,300 (signed audit shown in the prototype)
  {
    const wk = Array.from({ length: 7 }, (_, i) => addDays("2026-10-26", i));
    const cells = wk.flatMap((d) => BRANCHES.map((b) => key(b, d)));
    const sum = cells.reduce((s, k) => s + rev.get(k)!, 0);
    cells.forEach((k) => rev.set(k, Math.max(1500, round5((rev.get(k)! * W44_TOTAL) / sum))));
    const fixed = cells.reduce((s, k) => s + rev.get(k)!, 0);
    const biggest = cells.reduce((a, k) => (rev.get(k)! > rev.get(a)! ? k : a), cells[0]);
    rev.set(biggest, rev.get(biggest)! + (W44_TOTAL - fixed));
  }

  // ---- units per branch/day/product ----
  const units = new Map<string, Record<ProductName, number>>();
  for (const d of days) for (const b of BRANCHES) units.set(key(b, d), splitTotal(rev.get(key(b, d))!));
  // 08 Nov units (needed for baselines)
  const nov8Units = new Map<string, Record<ProductName, number>>();
  const msNov8 = { "Chicken empanada": 0, "Cheese roll": 0, "Banana loaf": 0 } as Record<ProductName, number>;
  for (const s of MAIN_STREET_NOV8) msNov8[s.product] += s.qty;
  nov8Units.set("Main Street", msNov8);
  nov8Units.set("Market Road", splitTotal(DAILY_SALES["Market Road"][6]));
  nov8Units.set("Town Center", splitTotal(DAILY_SALES["Town Center"][6]));

  // ---- constant stock balances (the 08 Nov opening positions) ----
  const X: Record<string, Record<ProductName, number>> = {
    "Main hub": { "Chicken empanada": 120, "Cheese roll": 111, "Banana loaf": 70 },
    "Main Street": { "Chicken empanada": 7, "Cheese roll": 80, "Banana loaf": 40 },
  };
  for (const b of ["Market Road", "Town Center"] as const) {
    const u = nov8Units.get(b)!;
    X[b] = { "Chicken empanada": u["Chicken empanada"] + 45, "Cheese roll": u["Cheese roll"] + 45, "Banana loaf": u["Banana loaf"] + 45 };
  }

  // ---- designed batches of 08 Nov (also the baseline batches) ----
  const designed: Record<ProductName, string> = { "Chicken empanada": "N8|E", "Cheese roll": "N8|C", "Banana loaf": "N8|B" };
  plan.batches.push(
    { key: "N8|E", no: "B-1108", product: "Chicken empanada", qty: 100, bb: "2026-11-10", ref: "", at: at(NOV8, "09:30") },
    { key: "N8|C", no: "B-1108", product: "Cheese roll", qty: 120, bb: "2026-11-12", ref: "", at: at("2026-11-07", "18:00") },
    { key: "N8|B", no: "B-1107", product: "Banana loaf", qty: 90, bb: "2026-11-11", ref: "", at: at("2026-11-07", "18:00") },
  );

  const L = (product: string, batchKey: string, loc: string, type: string, qty: number, ref: string, by: string | null, when: string) =>
    plan.ledger.push({ product, batchKey, loc, type, qty, ref, by, at: when });

  // starting balances
  for (const loc of ["Main hub", ...BRANCHES] as const)
    for (const p of PRODUCT_NAMES) L(p, designed[p], loc, "opening_baseline", X[loc][p], "BASE-1005", loc === "Main hub" ? "marco.santos" : BRANCH_STAFF[loc as BranchName], at(HISTORY_START, "05:00"));

  // ---- events: count variances and short deliveries ----
  type Ev = { variance?: number; short?: number };
  const events = new Map<string, Ev>();
  for (const d of days) {
    if (d >= FINAL_WEEK_START || d === HISTORY_START) continue;
    for (const b of BRANCHES) for (const p of PRODUCT_NAMES) {
      const r = rnd();
      if (r < 0.006) events.set(`${d}|${b}|${p}`, { variance: [-1, -2, -3, -2, 1][Math.floor(rnd() * 5)] });
      else if (r < 0.011) events.set(`${d}|${b}|${p}`, { short: 1 + Math.floor(rnd() * 3) });
    }
  }
  // flagged this week, approved by the owner during the week (the prototype shows 3 approvals)
  events.set("2026-11-02|Market Road|Cheese roll", { variance: -3 });
  events.set("2026-11-04|Town Center|Banana loaf", { variance: -2 });
  events.set("2026-11-05|Main Street|Chicken empanada", { variance: -1 });

  const nextDay = (d: string) => addDays(d, 1);
  const pendingDisc = new Map<string, string>(); // `${nextDay}|${branch}|${product}` -> disc code to resolve
  const pendingDelivery: { code: string; resolveOn: string }[] = [];
  let prodN = 0, recvN = 0;

  // ---- daily history ----
  for (const d of days) {
    const dayBatches = new Map<string, number>(); // product -> sum dispatched
    const batchKey = (p: string) => `${d}|${p}`;
    const rows: { b: BranchName; p: ProductName; D: number; R: number; S: number; A: number; k: number }[] = [];

    for (const b of BRANCHES) for (const p of PRODUCT_NAMES) {
      const S = units.get(key(b, d))![p];
      const ev = events.get(`${d}|${b}|${p}`) ?? {};
      // adjustment approved this morning for yesterday's count variance
      const prev = events.get(`${addDays(d, -1)}|${b}|${p}`);
      const A = prev?.variance ?? 0;
      const k = ev.short ?? 0;
      const R = S - A;
      rows.push({ b, p, D: R + k, R, S, A, k });
      dayBatches.set(p, (dayBatches.get(p) ?? 0) + R + k);
    }

    // production covers the day's dispatches
    for (const p of PRODUCT_NAMES) {
      const total = dayBatches.get(p)!;
      plan.batches.push({ key: batchKey(p), no: `B-${mmdd(d)}`, product: p, qty: total, bb: addDays(d, SHELF_DAYS[p]), ref: `PROD-${pad(++prodN, 4)}`, at: at(d, "06:00") });
      L(p, batchKey(p), "Main hub", "production_output", total, `PROD-${pad(prodN, 4)}`, "marco.santos", at(d, "06:00"));
    }

    // dispatches + receipts + adjustments + sales per branch/product
    const closingItems = new Map<string, { product: string; openingReceived: number; sold: number; expected: number; physical: number }[]>();
    for (const r of rows) {
      const bk = batchKey(r.p);
      const staff = BRANCH_STAFF[r.b];
      const code = `DSP-${pad(++plan.counters.dsp, 4)}`;
      L(r.p, bk, "Main hub", "dispatch_out", -r.D, code, "marco.santos", at(d, "07:45"));
      L(r.p, bk, r.b, "receipt_in", r.R, `RECV-${pad(++recvN, 4)}`, staff, at(d, "08:30"));
      plan.dispatches.push({ code, product: r.p, batchKey: bk, branch: r.b, sent: r.D, received: r.R, status: "received", at: at(d, "07:45"), recvAt: at(d, "08:30"), recvBy: staff, note: r.k ? `${r.k} unit(s) short on arrival` : null, receiptRef: `RECV-${pad(recvN, 4)}` });

      if (r.k) {
        const dc = `DISC-${pad(++plan.counters.disc, 3)}`;
        plan.discrepancies.push({ code: dc, type: "delivery", ref: code, branch: r.b, product: r.p, expected: r.D, actual: r.R, status: "resolved", note: `${r.k} unit(s) missing from the delivery.`, reason: "Verified shortage; actual receipt retained", createdBy: staff, reviewedBy: "juan.delacruz", createdAt: at(d, "08:30"), resolvedAt: at(nextDay(d), "10:00") });
      }
      if (r.A) {
        const dc = pendingDisc.get(`${d}|${r.b}|${r.p}`) ?? null;
        L(r.p, bk, r.b, "adjustment", r.A, dc ?? "ADJ", "juan.delacruz", at(d, "09:00"));
        const idx = dc ? plan.discrepancies.findIndex((x) => x.code === dc) : -1;
        const reason = COUNT_REASONS[(idx + 7) % COUNT_REASONS.length];
        if (idx >= 0) { plan.discrepancies[idx].reason = reason; plan.discrepancies[idx].resolvedAt = at(d, "09:15"); plan.discrepancies[idx].reviewedBy = "juan.delacruz"; }
        plan.adjustments.push({ discCode: dc, branch: r.b, product: r.p, qty: r.A, reason, at: at(d, "09:15") });
      }
      const code2 = `TXN-${pad(++plan.counters.txn, 4)}`;
      plan.sales.push({ code: code2, localRef: null, branch: r.b, product: r.p, qty: r.S, status: "synced", by: staff, at: at(d, "17:00") });
      L(r.p, bk, r.b, "sale", -r.S, code2, staff, at(d, "17:00"));

      const physical = X[r.b][r.p] + (events.get(`${d}|${r.b}|${r.p}`)?.variance ?? 0);
      const list = closingItems.get(r.b) ?? [];
      list.push({ product: r.p, openingReceived: X[r.b][r.p] + r.R + r.A, sold: r.S, expected: X[r.b][r.p], physical });
      closingItems.set(r.b, list);
    }

    // closings (counted at 16:30) and the count discrepancies they raise
    for (const b of BRANCHES) {
      const items = closingItems.get(b)!;
      const flagged = items.filter((i) => i.physical !== i.expected);
      const code = `CLOSE-${d.slice(2, 4)}${mmdd(d)}-${TAG[b]}`;
      let confirmedAt = at(d, "18:30");
      for (const f of flagged) {
        const dc = `DISC-${pad(++plan.counters.disc, 3)}`;
        pendingDisc.set(`${nextDay(d)}|${b}|${f.product}`, dc);
        plan.discrepancies.push({ code: dc, type: "count", ref: code, branch: b, product: f.product, expected: f.expected, actual: f.physical, status: "resolved", note: "Count differs from expected. Please verify.", reason: null, createdBy: BRANCH_STAFF[b], reviewedBy: null, createdAt: at(d, "16:30"), resolvedAt: null });
        confirmedAt = at(nextDay(d), "09:20");
      }
      plan.closings.push({ code, branch: b, date: d, status: "confirmed", note: flagged.length ? "Count differs from expected. Please verify." : null, by: BRANCH_STAFF[b], submittedAt: at(d, "16:30"), confirmedAt, items });
    }
  }

  // ---- 08 Nov (prototype): current day, still in progress ----
  const stamp = (t: string) => at(NOV8, t);
  const hubStaff = "marco.santos";
  // hub: production 100 empanadas, dispatch 60 to Main Street, 30 banana loaves to Town Center
  const prodN8 = `PROD-${pad(++prodN, 4)}`;
  plan.batches.find((b) => b.key === "N8|E")!.ref = prodN8;
  plan.ledger.push({ product: "Chicken empanada", batchKey: designed["Chicken empanada"], loc: "Main hub", type: "production_output", qty: 100, ref: prodN8, by: hubStaff, at: stamp("09:30") });
  const dspMS = `DSP-${pad(++plan.counters.dsp, 4)}`;
  const dspTC = `DSP-${pad(++plan.counters.dsp, 4)}`;
  L("Chicken empanada", designed["Chicken empanada"], "Main hub", "dispatch_out", -60, dspMS, hubStaff, stamp("10:00"));
  L("Banana loaf", designed["Banana loaf"], "Main hub", "dispatch_out", -30, dspTC, hubStaff, stamp("10:20"));
  plan.dispatches.push(
    { code: dspTC, product: "Banana loaf", batchKey: designed["Banana loaf"], branch: "Town Center", sent: 30, received: null, status: "in_transit", at: stamp("10:20"), recvAt: null, recvBy: null, note: null, receiptRef: null },
    { code: dspMS, product: "Chicken empanada", batchKey: designed["Chicken empanada"], branch: "Main Street", sent: 60, received: 58, status: "receipt_review", at: stamp("10:00"), recvAt: stamp("10:30"), recvBy: "ana.reyes", note: "Two units missing from sealed delivery.", receiptRef: `RECV-${pad(++recvN, 4)}` },
  );
  L("Chicken empanada", designed["Chicken empanada"], "Main Street", "receipt_in", 58, `RECV-${pad(recvN, 4)}`, "ana.reyes", stamp("10:30"));
  // Main Street sales: individual transactions
  for (const s of MAIN_STREET_NOV8) {
    const code = `TXN-${pad(++plan.counters.txn, 4)}`;
    plan.sales.push({ code, localRef: null, branch: "Main Street", product: s.product, qty: s.qty, status: "synced", by: "ana.reyes", at: stamp(s.time) });
    L(s.product, designed[s.product], "Main Street", "sale", -s.qty, code, "ana.reyes", stamp(s.time));
  }
  plan.sales.push(
    { code: null, localRef: "LOCAL-021", branch: "Main Street", product: "Banana loaf", qty: 2, status: "queued", by: "ana.reyes", at: stamp("15:20") },
    { code: null, localRef: "LOCAL-022", branch: "Main Street", product: "Cheese roll", qty: 4, status: "queued", by: "ana.reyes", at: stamp("15:40") },
  );
  for (const b of ["Market Road", "Town Center"] as const)
    for (const p of PRODUCT_NAMES) {
      const q = nov8Units.get(b)![p];
      const code = `TXN-${pad(++plan.counters.txn, 4)}`;
      plan.sales.push({ code, localRef: null, branch: b, product: p, qty: q, status: "synced", by: BRANCH_STAFF[b], at: stamp("17:00") });
      L(p, designed[p], b, "sale", -q, code, BRANCH_STAFF[b], stamp("17:00"));
    }

  // Nov 8 closings: Main Street submitted with a variance, Market Road confirmed, Town Center still open
  const msItems = [
    { product: "Chicken empanada", openingReceived: 65, sold: 23, expected: 42, physical: 40 },
    { product: "Cheese roll", openingReceived: 80, sold: 30, expected: 50, physical: 50 },
    { product: "Banana loaf", openingReceived: 40, sold: 15, expected: 25, physical: 25 },
  ];
  const mrItems = PRODUCT_NAMES.map((p) => ({ product: p as string, openingReceived: nov8Units.get("Market Road")![p] + 45, sold: nov8Units.get("Market Road")![p], expected: 45, physical: 45 }));
  const closeCode = (b: BranchName) => `CLOSE-26${mmdd(NOV8)}-${TAG[b]}`;
  plan.closings.push(
    { code: closeCode("Main Street"), branch: "Main Street", date: NOV8, status: "submitted", note: "Two units damaged during display. Please verify.", by: "ana.reyes", submittedAt: stamp("16:00"), confirmedAt: null, items: msItems },
    { code: closeCode("Market Road"), branch: "Market Road", date: NOV8, status: "confirmed", note: null, by: "paolo.garcia", submittedAt: stamp("16:00"), confirmedAt: stamp("17:30"), items: mrItems },
    { code: closeCode("Town Center"), branch: "Town Center", date: NOV8, status: "open", note: null, by: "liza.mendoza", submittedAt: null, confirmedAt: null, items: [] },
  );
  plan.discrepancies.push(
    { code: `DISC-${pad(++plan.counters.disc, 3)}`, type: "delivery", ref: dspMS, branch: "Main Street", product: "Chicken empanada", expected: 60, actual: 58, status: "open", note: "Two units missing from sealed delivery.", reason: null, createdBy: "ana.reyes", reviewedBy: null, createdAt: stamp("10:30"), resolvedAt: null },
    { code: `DISC-${pad(++plan.counters.disc, 3)}`, type: "count", ref: closeCode("Main Street"), branch: "Main Street", product: "Chicken empanada", expected: 42, actual: 40, status: "open", note: "Two units damaged during display. Please verify.", reason: "Damaged goods (proposed)", createdBy: "ana.reyes", reviewedBy: null, createdAt: stamp("16:00"), resolvedAt: null },
  );

  // ---- weekly audits ----
  for (let m = HISTORY_START; m < FINAL_WEEK_START; m = addDays(m, 7)) {
    const end = addDays(m, 6);
    const total = plan.sales.filter((s) => s.status === "synced" && s.at.slice(0, 10) >= m && s.at.slice(0, 10) <= end).reduce((a, s) => a + s.qty * PRICES[s.product], 0);
    const { year, week } = isoWeek(m);
    plan.audits.push({ code: `AUD-${year}-W${pad(week, 2)}`, start: m, end, status: "signed_off", total, note: "Reviewed daily summaries, deliveries and approved adjustments.", signedAt: at(addDays(end, 1), "09:00") });
  }
  plan.audits.push({ code: "AUD-2026-W45", start: FINAL_WEEK_START, end: NOV8, status: "in_review", total: 90145, note: null, signedAt: null });

  // ---- material deliveries and daily usage ----
  // Built backwards from the 08 Nov opening so each day's opening is the previous verified closing
  // and the stock never jumps. A delivery resets the pre-delivery level to a low point near the threshold.
  const avgRev = [...rev.values()].reduce((a, b) => a + b, 0) / days.length / 3;
  const GAP: Record<string, number> = { "All-purpose flour": 3, "White sugar": 4, Butter: 4, "Chicken filling": 3, "Cheese blend": 5, "Ripe bananas": 3, "Cooking oil": 7, Eggs: 4 };
  for (const m of MATERIAL_SPEC) {
    const step = m.name === "Eggs" || m.name === "White sugar" ? 0.5 : 0.1;
    const rd = (n: number) => Math.round(n / step) * step;
    let close: number = m.o8; // closing of the day being generated = opening of the day after
    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      const dayRev = BRANCHES.reduce((s, b) => s + rev.get(key(b, d))!, 0) / 3;
      const used = Math.max(step, rd(m.rate * (dayRev / avgRev) * (0.9 + 0.2 * rnd())));
      let open = rd(close + used);
      let recv = 0;
      if ((days.length - 1 - i) % GAP[m.name] === GAP[m.name] - 1) {
        const low = rd(m.thr + m.rate * (0.8 + 0.5 * rnd()));
        if (close + used - low > 0) { recv = rd(close + used - low); open = low; }
      }
      plan.usage.push({ date: d, material: m.name, opening: round1(open), received: round1(recv), closing: round1(close), used: round1(used) });
      if (recv > 0) plan.stockIns.push({ ref: "", material: m.name, qty: round1(recv), cost: m.cost, supplier: m.supplier, on: d });
      close = open;
    }
    plan.usage.push({ date: NOV8, material: m.name, opening: m.o8, received: 0, closing: m.c8, used: round1(m.o8 - m.c8) });
  }
  plan.usage.sort((a, b) => a.date.localeCompare(b.date) || a.material.localeCompare(b.material));
  plan.stockIns.sort((a, b) => a.on.localeCompare(b.on) || a.material.localeCompare(b.material));
  plan.stockIns.forEach((s, i) => (s.ref = `SUP-${pad(i + 1, 4)}`));

  void daysBetween;
  return plan;
}
