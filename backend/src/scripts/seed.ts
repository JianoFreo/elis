import bcrypt from "bcryptjs";
import { connectNeon, sql, pool } from "../config/db.js";
import {
  BRANCHES, BRANCH_STAFF, DAILY_SALES, DAYS, DEMO_USERS, MAIN_STREET_NOV8, PRICES, PRODUCT_NAMES,
  splitTotal, type ProductName,
} from "./seedData.js";

// Creates any missing tables, then inserts the starter data. Safe to re-run:
//   - master data (branches, actions, products, materials, demo users) uses ON CONFLICT DO NOTHING
//   - the sample week (02-08 Nov 2026) is inserted once, in one transaction, and skipped if DSP-0087 exists
await connectNeon();

// ---------------------------------------------------------------------------
// MASTER DATA
// ---------------------------------------------------------------------------

await sql`INSERT INTO branches (name, kind) VALUES
  ('Main hub','hub'), ('Main Street','branch'), ('Market Road','branch'), ('Town Center','branch')
  ON CONFLICT (name) DO NOTHING`;

await sql`INSERT INTO actions (action_name, module, is_sensitive) VALUES
  ('user.create','users',FALSE), ('user.activate','users',TRUE), ('user.deactivate','users',TRUE),
  ('user.delete','users',TRUE), ('user.permissions','users',TRUE),
  ('product.update','products',FALSE), ('material.update','materials',FALSE),
  ('production.record','inventory',FALSE), ('stock.baseline','inventory',TRUE),
  ('dispatch.create','dispatch',FALSE), ('receipt.confirm','dispatch',FALSE),
  ('sale.record','sales',FALSE), ('sale.sync','sales',FALSE), ('closing.submit','sales',FALSE),
  ('discrepancy.resolve','discrepancies',TRUE), ('adjustment.approve','discrepancies',TRUE),
  ('audit.signoff','audits',TRUE),
  ('material.stock_in','supplies',FALSE), ('usage.record','supplies',FALSE)
  ON CONFLICT (action_name) DO NOTHING`;

await sql`INSERT INTO products (name, description, price, cost, threshold)
  SELECT v.* FROM (VALUES
    ('Chicken empanada', 'Hand-folded savory chicken pastry.', 65, 38, 40),
    ('Cheese roll',      'Freshly baked cheese roll.',         45, 24, 30),
    ('Banana loaf',      'Fresh banana loaf.',                120, 72, 30)
  ) AS v(name, description, price, cost, threshold)
  WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name = v.name)`;

await sql`INSERT INTO materials (name, category, unit, cost, threshold, supplier)
  SELECT v.* FROM (VALUES
    ('All-purpose flour', 'Baking flour',      'kg',   55,  10, 'Local Milling Co.'),
    ('Butter',            'Dairy',             'kg',  220,   5, 'Dairy Supply Co.'),
    ('Chicken filling',   'Filling',           'kg',  180,   8, 'Fresh Market'),
    ('White sugar',       'Baking ingredient', 'kg',   65,   2, 'Local Milling Co.'),
    ('Cheese blend',      'Dairy',             'kg',  240,   4, 'Dairy Supply Co.'),
    ('Ripe bananas',      'Fruit',             'kg',   60,   6, 'Fresh Market'),
    ('Cooking oil',       'Oil',               'L',   110,   3, 'Fresh Market'),
    ('Eggs',              'Dairy',             'tray',210,   2, 'Fresh Market')
  ) AS v(name, category, unit, cost, threshold, supplier)
  WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.name = v.name)`;

// Demo accounts, one per role. Same password for all; override with SEED_PASSWORD.
const demoPassword = process.env.SEED_PASSWORD ?? "Eli2026!demo";
const hash = await bcrypt.hash(demoPassword, 10);
for (const u of DEMO_USERS) {
  await sql`INSERT INTO users (username, password_hash, full_name, email, role, branch_id)
    VALUES (${u.username}, ${hash}, ${u.full_name}, ${u.username + "@elis.local"}, ${u.role},
            (SELECT id FROM branches WHERE name = ${u.branch}))
    ON CONFLICT (username) DO NOTHING`;
}

// ---------------------------------------------------------------------------
// SAMPLE WEEK (02-08 Nov 2026)
// ---------------------------------------------------------------------------

// `npm run seed:reset` wipes the operational data (sales, ledger, dispatches, closings, audits, supplies) and
// re-inserts the sample week. Accounts, products and materials are kept.
if (process.argv.includes("--reset")) {
  await sql.query(`TRUNCATE material_usage, material_stock_in, weekly_audits, stock_adjustments, discrepancies,
    closing_items, daily_closings, sales, dispatches, stock_ledger, product_batches RESTART IDENTITY`);
  console.log("Operational data cleared");
}

const [already] = await sql`SELECT 1 FROM dispatches WHERE dispatch_code = 'DSP-0087'`;
if (already) {
  console.log("Sample week already seeded; skipping transactional data");
  await pool.end();
  process.exit(0);
}

const branchId = new Map<string, number>();
for (const r of await sql`SELECT id, name FROM branches`) branchId.set(r.name, r.id);
const productId = new Map<string, number>();
for (const r of await sql`SELECT id, name FROM products`) productId.set(r.name, r.id);
const userCode = new Map<string, string>();
for (const r of await sql`SELECT user_id, username FROM users`) userCode.set(r.username, r.user_id);
const material = new Map<string, { id: number; code: string }>();
for (const r of await sql`SELECT id, name, material_code FROM materials`)
  material.set(r.name, { id: r.id, code: r.material_code });

const B = (name: string) => branchId.get(name)!;
const P = (name: string) => productId.get(name)!;
const U = (username: string) => userCode.get(username)!;
const at = (date: string, time: string) => `${date} ${time}:00+08`; // Philippine time
const pad = (n: number, w: number) => String(n).padStart(w, "0");

const client = await pool.connect();
try {
  await client.query("BEGIN");

  // ----- batches (best-before dates from the inventory screen) -----
  const batchId = new Map<string, number>(); // by product name
  const batchSpecs = [
    { no: "B-1108", product: "Chicken empanada", qty: 100, bb: "2026-11-10", ref: "PROD-044" },
    { no: "B-1108", product: "Cheese roll", qty: 120, bb: "2026-11-12", ref: "PROD-043" },
    { no: "B-1107", product: "Banana loaf", qty: 90, bb: "2026-11-11", ref: "PROD-042" },
  ];
  for (const b of batchSpecs) {
    const r = await client.query(
      `INSERT INTO product_batches (batch_no, product_id, quantity_produced, best_before, production_ref, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [b.no, P(b.product), b.qty, b.bb, b.ref, U("marco.santos")],
    );
    batchId.set(b.product, r.rows[0].id);
  }

  const ledger = (product: string, branch: string, type: string, qty: number, ref: string, by: string | null, when: string) =>
    client.query(
      `INSERT INTO stock_ledger (product_id, batch_id, branch_id, movement_type, quantity, reference, recorded_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [P(product), batchId.get(product), B(branch), type, qty, ref, by ? U(by) : null, when],
    );

  let txn = 0;
  const sale = async (branch: string, product: ProductName, qty: number, date: string, time: string, status: "synced" | "queued" = "synced", localRef: string | null = null) => {
    const code = status === "synced" ? `TXN-${pad(++txn, 4)}` : null;
    const staff = BRANCH_STAFF[branch as keyof typeof BRANCH_STAFF];
    await client.query(
      `INSERT INTO sales (txn_code, local_ref, branch_id, product_id, quantity, unit_price, line_total, status, sold_by, sold_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [code, localRef, B(branch), P(product), qty, PRICES[product], PRICES[product] * qty, status, U(staff), at(date, time)],
    );
    return code;
  };

  // ----- sales for 02-07 Nov (one end-of-day line per branch and product) -----
  for (let d = 0; d < 6; d++)
    for (const branch of BRANCHES) {
      const split = splitTotal(DAILY_SALES[branch][d]);
      for (const p of PRODUCT_NAMES) await sale(branch, p, split[p], DAYS[d], "17:00");
    }

  // ----- 08 Nov: main hub ledger -----
  const nov8 = DAYS[6];
  await ledger("Chicken empanada", "Main hub", "opening_baseline", 120, "BASE-1108", "marco.santos", at(nov8, "08:00"));
  await ledger("Cheese roll", "Main hub", "opening_baseline", 111, "BASE-1108", "marco.santos", at(nov8, "08:00"));
  await ledger("Banana loaf", "Main hub", "opening_baseline", 70, "BASE-1107", "marco.santos", at(nov8, "08:00"));
  await ledger("Chicken empanada", "Main hub", "production_output", 100, "PROD-044", "marco.santos", at(nov8, "09:30"));
  await ledger("Chicken empanada", "Main hub", "dispatch_out", -60, "DSP-0087", "marco.santos", at(nov8, "10:00"));
  await ledger("Banana loaf", "Main hub", "dispatch_out", -30, "DSP-0085", "marco.santos", at(nov8, "10:20"));
  // hub now holds 160 + 111 + 40 = 311 units

  // ----- 08 Nov: Main Street (opening 7 + received 58 - sold 23 = 42 expected empanadas) -----
  await ledger("Chicken empanada", "Main Street", "opening_baseline", 7, "BASE-1108", "ana.reyes", at(nov8, "08:00"));
  await ledger("Cheese roll", "Main Street", "opening_baseline", 80, "BASE-1108", "ana.reyes", at(nov8, "08:00"));
  await ledger("Banana loaf", "Main Street", "opening_baseline", 40, "BASE-1107", "ana.reyes", at(nov8, "08:00"));
  await ledger("Chicken empanada", "Main Street", "receipt_in", 58, "RECV-0087", "ana.reyes", at(nov8, "10:30"));
  for (const s of MAIN_STREET_NOV8) {
    const code = await sale("Main Street", s.product, s.qty, nov8, s.time);
    await ledger(s.product, "Main Street", "sale", -s.qty, code!, "ana.reyes", at(nov8, s.time));
  }

  // two sales still queued on the device, waiting for a connection
  await sale("Main Street", "Banana loaf", 2, nov8, "15:20", "queued", "LOCAL-021");
  await sale("Main Street", "Cheese roll", 4, nov8, "15:40", "queued", "LOCAL-022");

  // ----- 08 Nov: Market Road and Town Center -----
  for (const branch of ["Market Road", "Town Center"] as const) {
    const split = splitTotal(DAILY_SALES[branch][6]);
    for (const p of PRODUCT_NAMES) {
      await ledger(p, branch, "opening_baseline", split[p] + 45, "BASE-1108", BRANCH_STAFF[branch], at(nov8, "08:00"));
      const code = await sale(branch, p, split[p], nov8, "17:00");
      await ledger(p, branch, "sale", -split[p], code!, BRANCH_STAFF[branch], at(nov8, "17:00"));
    }
  }

  // ----- dispatches -----
  const dispatch = (code: string, product: string, branch: string, qty: number, received: number | null, status: string,
                    when: string, recvAt: string | null, recvBy: string | null, note: string | null) =>
    client.query(
      `INSERT INTO dispatches (dispatch_code, product_id, batch_id, branch_id, quantity_dispatched, quantity_received, status,
                               prepared_by, dispatched_at, receipt_ref, received_by, received_at, delivery_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [code, P(product), batchId.get(product), B(branch), qty, received, status, U("marco.santos"), when,
       received === null ? null : code.replace("DSP", "RECV"), recvBy ? U(recvBy) : null, recvAt, note],
    );
  await dispatch("DSP-0083", "Banana loaf", "Main Street", 25, 25, "received", at("2026-11-06", "09:30"), at("2026-11-06", "10:10"), "ana.reyes", null);
  await dispatch("DSP-0084", "Cheese roll", "Town Center", 30, 30, "received", at("2026-11-07", "09:00"), at("2026-11-07", "09:50"), "liza.mendoza", null);
  await dispatch("DSP-0086", "Chicken empanada", "Market Road", 45, 45, "received", at("2026-11-07", "10:00"), at("2026-11-07", "10:40"), "paolo.garcia", null);
  await dispatch("DSP-0085", "Banana loaf", "Town Center", 30, null, "in_transit", at(nov8, "10:20"), null, null, null);
  await dispatch("DSP-0087", "Chicken empanada", "Main Street", 60, 58, "receipt_review", at(nov8, "10:00"), at(nov8, "10:30"), "ana.reyes", "Two units missing from sealed delivery.");

  // ----- daily closings: 21 (7 days x 3 branches); 19 confirmed, Main Street submitted, Town Center still open on 08 Nov -----
  const suffix = { "Main Street": "", "Market Road": "-MR", "Town Center": "-TC" } as const;
  const closingId = new Map<string, number>();
  for (let d = 0; d < 7; d++)
    for (const branch of BRANCHES) {
      const date = DAYS[d];
      const code = `CLOSE-${date.slice(5, 7)}${date.slice(8)}${suffix[branch]}`;
      let status = "confirmed";
      if (d === 6 && branch === "Main Street") status = "submitted";
      if (d === 6 && branch === "Town Center") status = "open";
      const note = d === 6 && branch === "Main Street" ? "Two units damaged during display. Please verify." : null;
      const r = await client.query(
        `INSERT INTO daily_closings (close_code, branch_id, closing_date, status, note, counted_by, submitted_at, confirmed_by, confirmed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [code, B(branch), date, status, note, U(BRANCH_STAFF[branch]),
         status === "open" ? null : at(date, "16:00"),
         status === "confirmed" ? U("juan.delacruz") : null,
         status === "confirmed" ? at(date, "18:00") : null],
      );
      closingId.set(code, r.rows[0].id);
    }
  // product-level count for the closing that has a variance: [opening+received, sold, expected, physical]
  const items: [ProductName, number, number, number, number][] = [
    ["Chicken empanada", 65, 23, 42, 40], ["Cheese roll", 80, 30, 50, 50], ["Banana loaf", 40, 15, 25, 25],
  ];
  for (const [p, open, sold, expected, physical] of items)
    await client.query(
      `INSERT INTO closing_items (closing_id, product_id, opening_received, sold, expected, physical, variance)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [closingId.get("CLOSE-1108"), P(p), open, sold, expected, physical, physical - expected],
    );

  // ----- discrepancies (both open, waiting for the owner) -----
  await client.query(
    `INSERT INTO discrepancies (disc_code, source_type, source_ref, branch_id, product_id, expected_qty, actual_qty, variance, status, note, reason, created_by, created_at)
     VALUES ('DISC-001','count','CLOSE-1108',$1,$2,42,40,-2,'open','Two units damaged during display. Please verify.','Damaged goods (proposed)',$3,$4)`,
    [B("Main Street"), P("Chicken empanada"), U("ana.reyes"), at(nov8, "16:00")],
  );
  await client.query(
    `INSERT INTO discrepancies (disc_code, source_type, source_ref, branch_id, product_id, expected_qty, actual_qty, variance, status, note, created_by, created_at)
     VALUES ('DISC-002','delivery','DSP-0087',$1,$2,60,58,-2,'open','Two units missing from sealed delivery.',$3,$4)`,
    [B("Main Street"), P("Chicken empanada"), U("ana.reyes"), at(nov8, "10:30")],
  );

  // ----- 3 owner-approved adjustments earlier in the week -----
  const adjustments: [string, string, number, string, string][] = [
    ["Market Road", "Cheese roll", -3, "Damaged in transit", "2026-11-03"],
    ["Town Center", "Banana loaf", -2, "Expired before sale", "2026-11-05"],
    ["Main Street", "Chicken empanada", -1, "Spoilage", "2026-11-06"],
  ];
  for (const [branch, product, qty, reason, date] of adjustments)
    await client.query(
      `INSERT INTO stock_adjustments (product_id, branch_id, quantity, reason, approved_by, approved_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [P(product), B(branch), qty, reason, U("juan.delacruz"), at(date, "18:30")],
    );

  // ----- weekly audits -----
  await client.query(
    `INSERT INTO weekly_audits (audit_code, week_start, week_end, status, total_sales, note, signed_by, signed_at)
     VALUES ('AUD-2026-W44','2026-10-26','2026-11-01','signed_off',88300,'Reviewed daily summaries, deliveries and approved adjustments.',$1,$2)`,
    [U("juan.delacruz"), at("2026-11-02", "09:00")],
  );
  await client.query(
    `INSERT INTO weekly_audits (audit_code, week_start, week_end, status, total_sales) VALUES ('AUD-2026-W45','2026-11-02','2026-11-08','in_review',90145)`,
  );

  // ----- supplies: deliveries earlier in the week, then the 08 Nov shift counts -----
  const stockIn: [string, string, number, string, string][] = [
    ["SUP-0138", "All-purpose flour", 40, "Local Milling Co.", "2026-11-03"],
    ["SUP-0139", "White sugar", 20, "Local Milling Co.", "2026-11-04"],
    ["SUP-0140", "Butter", 15, "Dairy Supply Co.", "2026-11-05"],
    ["SUP-0141", "Chicken filling", 25, "Fresh Market", "2026-11-06"],
  ];
  for (const [ref, name, qty, supplier, date] of stockIn) {
    const m = (await client.query(`SELECT cost FROM materials WHERE id = $1`, [material.get(name)!.id])).rows[0];
    await client.query(
      `INSERT INTO material_stock_in (receipt_ref, material_id, quantity, unit_cost, supplier, received_on, received_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [ref, material.get(name)!.id, qty, m.cost, supplier, date, U("rica.cruz")],
    );
  }

  // [material, opening, received, closing]; used = opening + received - closing
  const usage: [string, number, number, number][] = [
    ["All-purpose flour", 20, 0, 8], // 12 kg used; 8 kg left is under the 10 kg threshold (low-stock alert)
    ["White sugar", 20, 0, 0.8],     // 19.2 kg used, 96% of supply
    ["Butter", 16, 0, 12],
    ["Chicken filling", 22, 0, 18],
    ["Cheese blend", 15, 0, 11.5],
    ["Ripe bananas", 30, 0, 22],
    ["Cooking oil", 12, 0, 9.5],
    ["Eggs", 10, 0, 7],
  ];
  for (const [name, open, received, close] of usage) {
    const m = material.get(name)!;
    await client.query(
      `INSERT INTO material_usage (record_ref, usage_date, shift, material_id, branch_id, opening_qty, received_qty, closing_qty, used_qty, counted_by, closed_by)
       VALUES ($1,$2,'Morning',$3,$4,$5,$6,$7,$8,$9,$9)`,
      [`OPEN-1108-${m.code}`, nov8, m.id, B("Main hub"), open, received, close, +(open + received - close).toFixed(2), U("rica.cruz")],
    );
  }

  // keep the generated-code sequences ahead of the seeded codes
  await client.query(`SELECT setval('txn_code_seq', $1)`, [txn]);
  await client.query(`SELECT setval('dispatch_code_seq', 87)`);
  await client.query(`SELECT setval('discrepancy_code_seq', 2)`);

  await client.query("COMMIT");
  console.log(`Seeded sample week 02-08 Nov 2026 (${txn} synced sales, 5 dispatches, 21 closings, 2 open discrepancies)`);
  console.log(`Demo logins (password "${demoPassword}"): ${DEMO_USERS.map((u) => u.username).join(", ")}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
