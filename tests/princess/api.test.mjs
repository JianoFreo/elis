import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { db, query, reset, startServer } from "./database.mjs";
let api, server;
before(async () => {
  ({ api, server } = await startServer());
});
beforeEach(reset);
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await db.close();
});
const sale = (extra = {}) => ({
  product_code: "PRD-001",
  quantity: 3,
  local_ref: "L-test-1",
  ...extra,
});
const post = (path, body, user = "sales") =>
  api(path, { method: "POST", body, user });
const stock = async (branch = 2, product = 1) =>
  Number(
    (
      await query(
        "SELECT COALESCE(SUM(quantity),0)::int AS n FROM stock_ledger WHERE branch_id=$1 AND product_id=$2",
        [branch, product],
      )
    ).rows[0].n,
  );
const count = async (table) =>
  Number((await query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n);
const closing = (physical = 20, note = null) => ({
  counts: [
    { product_code: "PRD-001", physical },
    { product_code: "PRD-002", physical: 10 },
  ],
  note,
});

test("authentication and role guards protect Princess APIs", async () => {
  assert.equal(
    (await api("/api/production/inventory", { user: "anonymous" })).status,
    401,
  );
  assert.equal(
    (await api("/api/production/inventory", { user: "staff" })).status,
    403,
  );
  assert.equal(
    (
      await post(
        "/api/production/production-output",
        { product_code: "PRD-001", batch_no: "X", quantity: 2 },
        "sales",
      )
    ).status,
    403,
  );
});
test("product registration validates money and supports production-head creation", async () => {
  for (const body of [
    { name: "X", price: -1, cost: 2 },
    { name: " ", price: 1, cost: 2 },
    { name: "X", price: 1, cost: 2, threshold: 0.5 },
  ])
    assert.equal(
      (await post("/api/production/products", body, "head")).status,
      400,
    );
  const r = await post(
    "/api/production/products",
    { name: " New pastry ", price: 20, cost: 10, threshold: 3 },
    "head",
  );
  assert.equal(r.status, 201);
  assert.equal(r.body.product_code, "PRD-003");
  assert.equal(
    (
      await post(
        "/api/production/products",
        { name: "new pastry", price: 20, cost: 10 },
        "owner",
      )
    ).status,
    409,
  );
  const inv = await api("/api/production/inventory", { user: "head" });
  assert.equal(inv.status, 200);
  assert(
    inv.body.rows.some((r) => r.product_code === "PRD-003" && r.qty === 0),
  );
});
test("product master rejects negative values and clears description and latest batch date atomically", async () => {
  assert.equal(
    (
      await api("/api/production/products/PRD-001", {
        method: "PATCH",
        user: "head",
        body: { price: -5 },
      })
    ).status,
    400,
  );
  const r = await api("/api/production/products/PRD-001", {
    method: "PATCH",
    user: "head",
    body: { price: 66, cost: 39, description: null, best_before: null },
  });
  assert.equal(r.status, 200);
  const p = await api("/api/production/inventory/PRD-001", { user: "head" });
  assert.equal(p.body.product.price, 66);
  assert.equal(p.body.product.cost, 39);
  assert.equal(p.body.batch.best_before, null);
});
test("production retries reuse one ledger credit and generated reference", async () => {
  const body = {
    product_code: "PRD-001",
    batch_no: "TEST-BATCH",
    quantity: 6,
    best_before: "2026-11-10",
    request_ref: "production-1",
  };
  const a = await post("/api/production/production-output", body, "head"),
    b = await post("/api/production/production-output", body, "head");
  assert.equal(a.status, 201);
  assert.equal(b.status, 200);
  assert.equal(a.body.production_ref, b.body.production_ref);
  assert.equal(await stock(1), 26);
  assert.equal(
    (
      await post(
        "/api/production/production-output",
        { ...body, quantity: 7 },
        "head",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await post(
        "/api/production/production-output",
        { ...body, best_before: "2026-11-31" },
        "head",
      )
    ).status,
    400,
  );
});
test("baseline is initial-only; external receipts and retries have distinct safe semantics", async () => {
  const b = {
    product_code: "PRD-001",
    batch_no: "BASE-NEW",
    branch_id: 3,
    quantity: 4,
    reference: "initial",
    entry_type: "opening",
  };
  assert.equal(
    (await post("/api/production/stock-baseline", b, "head")).status,
    201,
  );
  assert.equal(
    (await post("/api/production/stock-baseline", b, "head")).status,
    200,
  );
  assert.equal(await stock(3), 4);
  assert.equal(
    (
      await post(
        "/api/production/stock-baseline",
        { ...b, reference: "another" },
        "head",
      )
    ).status,
    409,
  );
  const receipt = {
    ...b,
    entry_type: "received",
    quantity: 3,
    reference: "external-receipt",
  };
  assert.equal(
    (await post("/api/production/stock-baseline", receipt, "head")).status,
    201,
  );
  assert.equal(await stock(3), 7);
  assert.equal(
    (
      await post(
        "/api/production/stock-baseline",
        { ...receipt, quantity: 0 },
        "head",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/api/production/stock-baseline",
        { ...receipt, branch_id: 999, reference: "bad-location" },
        "head",
      )
    ).status,
    400,
  );
});
test("stock and numeric validation rejects overselling without partial rows", async () => {
  assert.equal(
    (await post("/api/sales/sales", sale({ quantity: 21 }))).status,
    409,
  );
  assert.equal(await count("sales"), 0);
  assert.equal(await stock(), 20);
  for (const q of [null, "", "   ", true, [], [1], {}, 0, -1, 1.5])
    assert.equal(
      (await post("/api/sales/sales", sale({ quantity: q }))).status,
      400,
    );
  const r = await post(
    "/api/sales/sales",
    sale({ quantity: 2, unit_price: 0.01 }),
  );
  assert.equal(r.status, 201);
  assert.equal(r.body.line_total, 130);
});
test("sales consume the branch batches earliest-best-before first", async () => {
  const r = await post("/api/sales/sales", sale({ quantity: 12 }));
  assert.equal(r.status, 201);
  assert.equal(r.body.stock_after, 8);
  const rows = (
    await query(
      "SELECT batch_id,SUM(quantity)::int AS qty FROM stock_ledger WHERE branch_id=2 AND product_id=1 GROUP BY batch_id ORDER BY batch_id",
    )
  ).rows;
  assert.deepEqual(rows, [
    { batch_id: 1, qty: 0 },
    { batch_id: 2, qty: 8 },
  ]);
  assert.equal(await stock(1), 20);
});
test("online retries return the same sale and conflicting references are rejected", async () => {
  const a = await post("/api/sales/sales", sale()),
    b = await post("/api/sales/sales", sale());
  assert.equal(a.status, 201);
  assert.equal(b.status, 200);
  assert.equal(b.body.replayed, true);
  assert.equal(a.body.txn_code, b.body.txn_code);
  assert.equal(await stock(), 17);
  assert.equal(await count("sales"), 1);
  assert.equal(
    (await post("/api/sales/sales", sale({ quantity: 2 }))).status,
    409,
  );
  assert.equal((await post("/api/sales/sales", sale(), "sales2")).status, 409);
});
test("server queued sales do not affect stock; partial sync retains failed records", async () => {
  assert.equal(
    (
      await post(
        "/api/sales/sales",
        sale({ quantity: 30, local_ref: "L-too-large", offline: true }),
      )
    ).status,
    201,
  );
  await post(
    "/api/sales/sales",
    sale({ quantity: 5, local_ref: "L-small", offline: true }),
  );
  assert.equal(await stock(), 20);
  const r = await post("/api/sales/sync", {});
  assert.equal(r.status, 200);
  assert.equal(r.body.synced.length, 1);
  assert.equal(r.body.failed[0].local_ref, "L-too-large");
  assert.equal(await stock(), 15);
  const again = await post("/api/sales/sync", {});
  assert.equal(again.body.synced.length, 0);
  assert.equal(await stock(), 15);
  assert.equal((await api("/api/sales/queue")).body.queue.length, 1);
});
test("the same queued reference promotes to a confirmed sale exactly once", async () => {
  const body = sale({ offline: true });
  await post("/api/sales/sales", body);
  assert.equal((await post("/api/sales/sales", body)).status, 200);
  assert.equal(
    (await post("/api/sales/sales", { ...body, offline: false })).body.status,
    "synced",
  );
  assert.equal(
    (await post("/api/sales/sales", { ...body, offline: false })).status,
    200,
  );
  assert.equal(await stock(), 17);
  assert.equal(await count("sales"), 1);
});
test("closing rejects duplicate products, missing products and blank physical counts", async () => {
  const duplicated = {
    counts: [
      { product_code: "PRD-001", physical: 20 },
      { product_code: "PRD-001", physical: 20 },
    ],
  };
  assert.equal((await post("/api/sales/closing", duplicated)).status, 400);
  assert.equal(
    (
      await post("/api/sales/closing", {
        counts: [{ product_code: "PRD-001", physical: 20 }],
      })
    ).status,
    400,
  );
  assert.equal((await post("/api/sales/closing", closing(null))).status, 400);
  assert.equal(await count("daily_closings"), 0);
});
test("pending sales block closing; submitting does not adjust stock", async () => {
  await post("/api/sales/sales", sale({ offline: true }));
  assert.equal((await post("/api/sales/closing", closing())).status, 409);
  await post("/api/sales/sync", {});
  assert.equal((await post("/api/sales/closing", closing(16))).status, 400);
  assert.equal(
    (await post("/api/sales/closing", closing(16, "One unit damaged"))).status,
    201,
  );
  assert.equal(await stock(), 17);
  assert.equal(await count("discrepancies"), 1);
  assert.equal(
    (await post("/api/sales/closing", closing(16, "again"))).status,
    409,
  );
  assert.equal(
    (await post("/api/sales/sales", sale({ local_ref: "L-after-close" })))
      .status,
    409,
  );
});
test("historical summary ignores later stock movements", async () => {
  await query(
    "INSERT INTO stock_ledger (product_id,batch_id,branch_id,movement_type,quantity,created_at) VALUES (1,2,2,'receipt_in',100,'2026-11-09T08:00:00+08:00')",
  );
  const r = await api("/api/sales/summary?date=2026-11-08");
  assert.equal(r.body.products[0].expected, 20);
  assert.equal(r.body.products[0].opening_received, 20);
  assert.equal((await api("/api/sales/summary?date=2026-02-31")).status, 400);
});
test("submitted expected and variance remain frozen after owner adjustments", async () => {
  await post("/api/sales/closing", closing(18, "Two damaged units"));
  await query(
    "INSERT INTO stock_ledger (product_id,batch_id,branch_id,movement_type,quantity,created_at) VALUES (1,2,2,'adjustment',-2,'2026-11-08T18:00:00+08:00')",
  );
  const r = await api("/api/sales/summary");
  assert.equal(r.body.products[0].expected, 20);
  assert.equal(r.body.products[0].counted, 18);
  assert.equal(r.body.variance, -2);
  assert.equal(await stock(), 18);
});
test("business date override aligns new sale, ledger and daily summary", async () => {
  const r = await post("/api/sales/sales", sale({ quantity: 1 }));
  assert.equal(r.status, 201);
  const day = (
    await query(
      "SELECT (sold_at AT TIME ZONE 'Asia/Manila')::date::text AS day FROM sales",
    )
  ).rows[0].day;
  assert.equal(day, "2026-11-08");
  assert.equal((await api("/api/sales/summary")).body.sales_total, 65);
  assert.equal(
    (
      await post(
        "/api/sales/sales",
        sale({ local_ref: "L-future", sold_at: "2026-11-09T10:00:00+08:00" }),
      )
    ).status,
    400,
  );
});
test("staff cannot switch branches; owner queries require explicit branch selection", async () => {
  await post("/api/sales/sales", sale());
  const r = await api("/api/sales/summary?branch_id=3");
  assert.equal(r.body.branch, "Main Street");
  assert.equal(r.body.sales_total, 195);
  assert.equal(
    (await api("/api/sales/summary", { user: "owner" })).status,
    400,
  );
  assert.equal(
    (await api("/api/sales/summary?branch_id=2", { user: "owner" })).body
      .sales_total,
    195,
  );
  assert.equal(
    (await api("/api/sales/summary", { user: "sales2" })).body.sales_total,
    0,
  );
});
test("signed next opening uses final confirmed closing, never the current live ledger", async () => {
  await post("/api/sales/closing", closing());
  await query("UPDATE daily_closings SET status='confirmed'");
  await query(
    "INSERT INTO weekly_audits (audit_code,week_start,week_end,status) VALUES ('AUD-TEST','2026-11-02','2026-11-08','signed_off')",
  );
  await query(
    "INSERT INTO stock_ledger (product_id,batch_id,branch_id,movement_type,quantity,created_at) VALUES (1,2,2,'receipt_in',100,'2026-11-09T08:00:00+08:00')",
  );
  const preview = await api("/api/owner/audits/AUD-TEST/baseline?branch_id=2", {
    user: "owner",
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.products[0].qty, 20);
  const before = await stock();
  const path = "/api/owner/audits/AUD-TEST/baseline";
  assert.equal((await post(path, { branch_id: 2 }, "owner")).status, 201);
  assert.equal((await post(path, { branch_id: 2 }, "owner")).status, 200);
  assert.equal(await stock(), before);
  assert.equal(
    (
      await query(
        "SELECT COUNT(*)::int AS n FROM stock_ledger WHERE reference LIKE 'NEXT-%'",
      )
    ).rows[0].n,
    2,
  );
  assert.equal(
    (
      await api("/api/owner/audits/AUD-TEST/baseline?branch_id=1", {
        user: "owner",
      })
    ).status,
    400,
  );
});
test("sales belonging to a signed week cannot post or synchronize", async () => {
  await post("/api/sales/sales", sale({ offline: true }));
  await query(
    "INSERT INTO weekly_audits (audit_code,week_start,week_end,status) VALUES ('AUD-LOCKED','2026-11-02','2026-11-08','signed_off')",
  );
  assert.equal(
    (await post("/api/sales/sales", sale({ local_ref: "L-locked" }))).status,
    409,
  );
  const r = await post("/api/sales/sync", {});
  assert.equal(r.body.failed.length, 1);
  assert.equal(await stock(), 20);
});
test("activity failure rolls back the sale and its stock movements together", async () => {
  await db.exec(
    "CREATE FUNCTION reject_test_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test-only activity failure'; END $$; CREATE TRIGGER reject_log BEFORE INSERT ON activity_logs FOR EACH ROW EXECUTE FUNCTION reject_test_log();",
  );
  try {
    assert.equal((await post("/api/sales/sales", sale())).status, 500);
    assert.equal(await count("sales"), 0);
    assert.equal(await stock(), 20);
  } finally {
    await db.exec(
      "DROP TRIGGER reject_log ON activity_logs; DROP FUNCTION reject_test_log()",
    );
  }
});

test("fully sold stock remains visible as a zero-stock alert", async () => {
  await post("/api/sales/sales", sale({ quantity: 20 }));
  const r = await api("/api/production/inventory", { user: "head" });
  assert(
    r.body.rows.some(
      (p) =>
        p.product_code === "PRD-001" &&
        p.location === "Main Street" &&
        p.qty === 0 &&
        p.status === "Low stock",
    ),
  );
});

test("legacy owner product URLs share the same validation without changing account actions", async () => {
  assert.equal(
    (
      await post(
        "/api/owner/products",
        { name: "Invalid legacy", price: -1, cost: 1 },
        "owner",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/api/owner/products/PRD-001", {
        user: "owner",
        method: "PATCH",
        body: { cost: -5 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/api/production/products/PRD-001", {
        user: "head",
        method: "PATCH",
        body: { active: false },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api("/api/owner/products/PRD-001", {
        user: "owner",
        method: "PATCH",
        body: { active: false },
      })
    ).status,
    200,
  );
  assert.equal((await post("/api/sales/sales", sale())).status, 409);
});
