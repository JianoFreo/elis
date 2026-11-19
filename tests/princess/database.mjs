// Isolated PostgreSQL WASM test database: no external Neon connection, credentials, or production writes.
import { mock } from "node:test";
import { PGlite } from "../../backend/node_modules/@electric-sql/pglite/dist/index.js";
import jwt from "../../backend/node_modules/jsonwebtoken/index.js";
import bcrypt from "../../backend/node_modules/bcryptjs/index.js";
process.env.DATABASE_URL = "postgresql://test:test@localhost/isolated";
process.env.JWT_SECRET = "isolated-test-secret-never-a-deployment-secret";
process.env.BUSINESS_DATE = "2026-11-08";
process.env.IS_PRODUCTION = "false";
const schema = await import("../../backend/dist/config/db.js");
export const db = new PGlite();
for (const seq of schema.SEQUENCES) await db.exec(`CREATE SEQUENCE ${seq}`);
for (const table of schema.TABLES)
  await db.exec(
    `CREATE TABLE "${table.table}" (${Object.entries(table.columns)
      .map(([k, v]) => `"${k}" ${v}`)
      .join(",")})`,
  );
for (const ddl of schema.INDEXES) await db.exec(ddl);
const query = async (text, params = []) => {
  const r = await db.query(text, params);
  return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
};
const sql = async (strings, ...values) => {
  const text = strings.reduce(
    (s, part, i) => s + part + (i < values.length ? `$${i + 1}` : ""),
    "",
  );
  return (await query(text, values)).rows;
};
sql.query = async (t, p = []) => (await query(t, p)).rows;
// PGlite is single-connection; serialize transaction clients for repeatable endpoint tests.
let tail = Promise.resolve();
const pool = {
  connect: async () => {
    let unlock;
    const prior = tail;
    tail = new Promise((r) => (unlock = r));
    await prior;
    return { query, release: () => unlock() };
  },
  end: async () => {},
};
mock.module(new URL("../../backend/dist/config/db.js", import.meta.url).href, {
  namedExports: { sql, pool },
});
export { query };
export const tokens = {};
export async function seed() {
  await db.exec(
    `INSERT INTO branches (id,name,kind) VALUES (1,'Main hub','hub'),(2,'Main Street','branch'),(3,'Market Road','branch');`,
  );
  const hash = await bcrypt.hash("TestPass123!", 4);
  for (const [id, username, role, branch] of [
    ["ACC-001", "owner", "owner", null],
    ["ACC-002", "sales", "sales-staff", 2],
    ["ACC-003", "head", "production-head", 1],
    ["ACC-004", "staff", "production-staff", 1],
    ["ACC-005", "sales2", "sales-staff", 3],
  ]) {
    await query(
      `INSERT INTO users (user_id,username,password_hash,full_name,role,branch_id) VALUES ($1,$2,$3,$2,$4,$5)`,
      [id, username, hash, role, branch],
    );
    tokens[username] = jwt.sign({ user_id: id }, process.env.JWT_SECRET);
  }
  await db.exec(`INSERT INTO products (product_code,name,price,cost,threshold) VALUES ('PRD-001','Empanada',65,38,5),('PRD-002','Roll',45,24,2);
    INSERT INTO product_batches (id,batch_no,product_id,quantity_produced,best_before) VALUES (1,'OLD',1,20,'2026-11-09'),(2,'NEW',1,20,'2026-11-10'),(3,'ROLL',2,10,'2026-11-10');
    SELECT setval('product_batches_id_seq',3);
    SELECT setval('product_code_seq',2);
    INSERT INTO stock_ledger (product_id,batch_id,branch_id,movement_type,quantity,reference,created_at) VALUES
      (1,1,2,'opening_baseline',10,'OPEN-OLD','2026-11-07T08:00:00+08:00'),
      (1,2,2,'receipt_in',10,'OPEN-NEW','2026-11-08T08:00:00+08:00'),
      (2,3,2,'opening_baseline',10,'OPEN-ROLL','2026-11-07T08:00:00+08:00'),
      (1,2,1,'production_output',20,'PROD-SEED','2026-11-08T07:00:00+08:00');`);
}
export async function startServer() {
  const { buildApp } = await import("../../backend/dist/app.js");
  const server = buildApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function api(path, { user = "sales", method = "GET", body } = {}) {
    const r = await fetch(origin + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(tokens[user] ? { authorization: `Bearer ${tokens[user]}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  }
  return { server, origin, api };
}
export async function reset() {
  await db.exec(
    `TRUNCATE ${schema.TABLES.map((t) => '"' + t.table + '"').join(",")} RESTART IDENTITY CASCADE`,
  );
  for (const seq of schema.SEQUENCES)
    await db.exec(`SELECT setval('${seq}',1,false)`);
  await seed();
}
