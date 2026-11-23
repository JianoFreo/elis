import bcrypt from "bcryptjs";
import { connectNeon, sql, pool } from "../config/db.js";
import { DEMO_USERS } from "./seedData.js";
import { buildPlan } from "./seedPlan.js";
import { insertPlan } from "./seedOperations.js";

// Creates any missing tables, then inserts the starter data. Safe to re-run:
//   - master data (branches, actions, products, materials, demo accounts) uses ON CONFLICT DO NOTHING
//   - the operating history (a bit over a year, 06 Oct 2025 .. 08 Nov 2026) is inserted once, in one
//     transaction, and skipped when the ledger already holds history.
//   - `npm run seed:reset` wipes the operating history first and loads it again.
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
const demoPassword = process.env.SEED_PASSWORD ?? "password";
const hash = await bcrypt.hash(demoPassword, 10);
for (const u of DEMO_USERS) {
  await sql`INSERT INTO users (username, password_hash, full_name, email, role, branch_id)
    VALUES (${u.username}, ${hash}, ${u.full_name}, ${u.username + "@elis.local"}, ${u.role},
            (SELECT id FROM branches WHERE name = ${u.branch}))
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`;
}

// ---------------------------------------------------------------------------
// OPERATING HISTORY
// ---------------------------------------------------------------------------

if (process.argv.includes("--reset")) {
  await sql.query(`TRUNCATE product_stock_requests, material_usage, material_stock_in, weekly_audits, stock_adjustments, discrepancies,
    closing_items, daily_closings, sales, dispatches, stock_ledger, product_batches RESTART IDENTITY`);
  await sql.query(`DELETE FROM activity_logs WHERE target_type IN ('sale','dispatch','closing','discrepancy','audit','material','batch','product')`);
  console.log("Operating data cleared");
}

const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM stock_ledger`;
if (n > 5000) {
  console.log("History already seeded; skipping. Run `npm run seed:reset` to reload it.");
  await pool.end();
  process.exit(0);
}
if (n > 0) {
  console.log("Found a small amount of older operating data. Run `npm run seed:reset` to replace it with the full history.");
  await pool.end();
  process.exit(0);
}

const lookups = {
  branch: new Map<string, number>((await sql`SELECT id, name FROM branches`).map((r) => [r.name, r.id])),
  product: new Map<string, number>((await sql`SELECT id, name FROM products`).map((r) => [r.name, r.id])),
  user: new Map<string, string>((await sql`SELECT user_id, username FROM users`).map((r) => [r.username, r.user_id])),
  material: new Map<string, { id: number; code: string }>((await sql`SELECT id, name, material_code FROM materials`).map((r) => [r.name, { id: r.id, code: r.material_code }])),
  action: new Map<string, number>((await sql`SELECT action_id, action_name FROM actions`).map((r) => [r.action_name, r.action_id])),
};

const plan = buildPlan();
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await insertPlan(client, plan, lookups);
  await client.query("COMMIT");
  console.log(
    `Seeded 06 Oct 2025 - 08 Nov 2026: ${plan.sales.length} sales lines, ${plan.dispatches.length} dispatches, ${plan.closings.length} daily closings, ` +
      `${plan.discrepancies.length} discrepancies, ${plan.audits.length} weekly audits, ${plan.usage.length} material usage records`,
  );
  console.log(`Demo logins (password "${demoPassword}"): ${DEMO_USERS.map((u) => u.username).join(", ")}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
