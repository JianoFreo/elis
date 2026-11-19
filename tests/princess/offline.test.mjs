import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enqueueSale,
  readLocalSales,
  removeLocalSale,
  reservedQuantity,
  salePayload,
  failLocalSale,
  newReference,
} from "../../frontend/src/lib/offlineSales.ts";
class MemoryStorage {
  map = new Map();
  getItem(k) {
    return this.map.get(k) ?? null;
  }
  setItem(k, v) {
    this.map.set(k, v);
  }
  removeItem(k) {
    this.map.delete(k);
  }
}
const a = { userId: "ACC-002", branchId: 2 },
  b = { userId: "ACC-005", branchId: 3 };
const sale = () => ({
  local_ref: newReference(),
  product_code: "PRD-001",
  product: "Empanada",
  quantity: 3,
  unit_price: 65,
  line_total: 195,
  sold_at: "2026-11-08T11:00:00+08:00",
});
test("offline entries survive new reads and stay isolated by user and branch", async () => {
  const s = new MemoryStorage(),
    r = sale();
  await enqueueSale(a, r, s);
  assert.deepEqual(readLocalSales(a, s), [r]);
  assert.deepEqual(readLocalSales(b, s), []);
  assert.equal(reservedQuantity(readLocalSales(a, s), "PRD-001"), 3);
});
test("queue references fit the server limit and are unique", () => {
  const refs = new Set(Array.from({ length: 1000 }, newReference));
  assert.equal(refs.size, 1000);
  assert([...refs].every((r) => r.length <= 40));
});
test("enqueue retry is idempotent; conflicting contents are rejected", async () => {
  const s = new MemoryStorage(),
    r = sale();
  await enqueueSale(a, r, s);
  await enqueueSale(a, r, s);
  assert.equal(readLocalSales(a, s).length, 1);
  await assert.rejects(enqueueSale(a, { ...r, quantity: 4 }, s));
});
test("failure retains exact sale and original timestamp for a safe replay", async () => {
  const s = new MemoryStorage(),
    r = sale();
  await enqueueSale(a, r, s);
  await failLocalSale(a, r.local_ref, "stock conflict", s);
  const saved = readLocalSales(a, s)[0];
  assert.equal(saved.error, "stock conflict");
  assert.equal(salePayload(saved).sold_at, r.sold_at);
  assert.equal(salePayload(saved).local_ref, r.local_ref);
  await removeLocalSale(a, r.local_ref, s);
  assert.equal(readLocalSales(a, s).length, 0);
});
test("unavailable device storage never reports that the sale was queued", async () => {
  const s = {
    getItem: () => null,
    setItem: () => {
      throw Error("quota");
    },
  };
  await assert.rejects(enqueueSale(a, sale(), s), /not queued yet/);
});
test("corrupt data is reported and never silently erased", () => {
  const s = new MemoryStorage();
  s.setItem("eyk:sales:v1:ACC-002:2", "{bad");
  assert.throws(() => readLocalSales(a, s), /not been erased/);
  assert.equal(s.getItem("eyk:sales:v1:ACC-002:2"), "{bad");
});
test("invalid local quantities are rejected before writing", async () => {
  const s = new MemoryStorage();
  for (const q of [0, -1, 1.5])
    await assert.rejects(enqueueSale(a, { ...sale(), quantity: q }, s));
  assert.deepEqual(readLocalSales(a, s), []);
});
