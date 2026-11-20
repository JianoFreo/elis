import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/config/env.js", () => ({ ENV: { BUSINESS_DATE: "2026-11-08" } }));
vi.mock("../src/config/db.js", () => ({ sql: vi.fn() }));

import {
  sellingBranch, activeProduct, lockBranch, assertDayOpen, postSaleStock, activity, priorOperation, rememberOperation,
} from "../src/utils/domain.js";
import { HttpError } from "../src/utils/http.js";

type Handler = (text: string, params: unknown[]) => { rows: unknown[] } | undefined;
/** A fake transaction client: `handler` answers queries, everything is recorded. */
const makeTx = (handler: Handler = () => ({ rows: [] })) => {
  const calls: { text: string; params: unknown[] }[] = [];
  const query = vi.fn(async (text: string, params: unknown[] = []) => {
    calls.push({ text, params });
    return handler(text, params) ?? { rows: [] };
  });
  return { tx: { query } as never, calls, query };
};
const rejects = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e as HttpError; }
  throw new Error("expected rejection");
};

describe("sellingBranch", () => {
  it("returns a selling branch", async () => {
    const b = { id: 2, name: "Pasig", kind: "branch" };
    expect(await sellingBranch(makeTx(() => ({ rows: [b] })).tx, 2)).toEqual(b);
  });
  it("400 for the main hub", async () =>
    expect((await rejects(sellingBranch(makeTx(() => ({ rows: [{ id: 1, kind: "hub" }] })).tx, 1))).status).toBe(400));
  it("400 for an unknown branch", async () =>
    expect((await rejects(sellingBranch(makeTx().tx, 99))).message).toContain("Choose a selling branch"));
});

describe("activeProduct", () => {
  it("returns an active product", async () => {
    const p = { id: 1, product_code: "P-1", name: "Pie", price: "50", active: true };
    expect(await activeProduct(makeTx(() => ({ rows: [p] })).tx, "P-1")).toEqual(p);
  });
  it("404 when missing", async () => {
    const e = await rejects(activeProduct(makeTx().tx, "P-9"));
    expect([e.status, e.message]).toEqual([404, "Product P-9 not found"]);
  });
  it("409 when inactive", async () =>
    expect((await rejects(activeProduct(makeTx(() => ({ rows: [{ active: false }] })).tx, "P-1"))).status).toBe(409));
  it("queries by product code", async () => {
    const { tx, calls } = makeTx(() => ({ rows: [{ active: true }] }));
    await activeProduct(tx, "P-7");
    expect(calls[0].params).toEqual(["P-7"]);
  });
});

describe("lockBranch", () => {
  it("takes an advisory lock for the branch", async () => {
    const { tx, calls } = makeTx();
    await lockBranch(tx, 5);
    expect(calls[0].text).toContain("pg_advisory_xact_lock");
    expect(calls[0].params).toEqual([5]);
  });
});

describe("assertDayOpen", () => {
  const handler = (closing: unknown, signed: unknown): Handler => (text) =>
    ({ rows: text.includes("daily_closings") ? (closing ? [closing] : []) : signed ? [signed] : [] });

  it("passes when no closing and no signed-off week", async () =>
    await expect(assertDayOpen(makeTx(handler(null, null)).tx, 1, "2026-11-08")).resolves.toBeUndefined());
  it("passes when the closing is still open", async () =>
    await expect(assertDayOpen(makeTx(handler({ status: "open" }, null)).tx, 1, "2026-11-08")).resolves.toBeUndefined());
  it("409 when the closing was submitted", async () => {
    const e = await rejects(assertDayOpen(makeTx(handler({ status: "submitted" }, null)).tx, 1, "2026-11-08"));
    expect([e.status, e.message]).toEqual([409, expect.stringContaining("closing is already submitted")]);
  });
  it("409 when the week is signed off", async () => {
    const e = await rejects(assertDayOpen(makeTx(handler(null, { "?column?": 1 })).tx, 1, "2026-11-08"));
    expect(e.message).toContain("signed-off week");
  });
});

describe("postSaleStock", () => {
  const ledgerTx = (available: number, batches: { batch_id: number | null; qty: number }[]) =>
    makeTx((text) => {
      if (text.includes("COALESCE(SUM(quantity),0)")) return { rows: [{ qty: available }] };
      if (text.includes("GROUP BY l.batch_id")) return { rows: batches };
      return { rows: [] };
    });
  const inserts = (calls: { text: string; params: unknown[] }[]) => calls.filter((c) => c.text.includes("INSERT INTO stock_ledger"));

  it("409 when stock is insufficient", async () => {
    const { tx } = ledgerTx(2, [{ batch_id: 1, qty: 2 }]);
    const e = await rejects(postSaleStock(tx, 1, 1, 5, "S-1", "U-1", "2026-11-08T01:00:00Z"));
    expect([e.status, e.message]).toEqual([409, "Only 2 units are in stock at this branch"]);
  });
  it("takes from a single batch and reports before/after", async () => {
    const { tx, calls } = ledgerTx(10, [{ batch_id: 1, qty: 10 }]);
    const r = await postSaleStock(tx, 1, 1, 4, "S-1", "U-1", "2026-11-08T01:00:00Z");
    expect(r).toEqual({ stock_before: 10, stock_after: 6 });
    expect(inserts(calls)).toHaveLength(1);
    expect(inserts(calls)[0].params.slice(0, 5)).toEqual([1, 1, 1, "sale", -4]);
  });
  it("spills across batches in order", async () => {
    const { tx, calls } = ledgerTx(10, [{ batch_id: 1, qty: 3 }, { batch_id: 2, qty: 7 }]);
    await postSaleStock(tx, 1, 1, 5, "S-1", "U-1", "2026-11-08T01:00:00Z");
    expect(inserts(calls).map((c) => [c.params[1], c.params[4]])).toEqual([[1, -3], [2, -2]]);
  });
  it("stops once the quantity is satisfied", async () => {
    const { tx, calls } = ledgerTx(10, [{ batch_id: 1, qty: 5 }, { batch_id: 2, qty: 5 }]);
    await postSaleStock(tx, 1, 1, 5, "S-1", "U-1", "2026-11-08T01:00:00Z");
    expect(inserts(calls)).toHaveLength(1);
  });
  it("409 when batches cannot cover a quantity the total says exists", async () => {
    const { tx } = ledgerTx(10, [{ batch_id: 1, qty: 3 }]);
    expect((await rejects(postSaleStock(tx, 1, 1, 5, "S-1", "U-1", "2026-11-08T01:00:00Z"))).message).toContain("Stock changed");
  });
  it("locks branch+product first", async () => {
    const { tx, calls } = ledgerTx(10, [{ batch_id: 1, qty: 10 }]);
    await postSaleStock(tx, 3, 8, 1, "S-1", "U-1", "2026-11-08T01:00:00Z");
    expect(calls[0].text).toContain("pg_advisory_xact_lock");
    expect(calls[0].params).toEqual([3, 8]);
  });
});

describe("activity", () => {
  it("registers the action then logs it", async () => {
    const { tx, calls } = makeTx();
    await activity(tx, "U-1", "sale.create", "sale", "S-1", { qty: 1 });
    expect(calls).toHaveLength(2);
    expect(calls[0].params).toEqual(["sale.create", "sale", false]);
    expect(calls[1].params).toEqual(["U-1", "sale.create", "sale", "S-1", '{"qty":1}']);
  });
  it("flags stock.baseline as sensitive", async () => {
    const { tx, calls } = makeTx();
    await activity(tx, "U-1", "stock.baseline", "stock", "x");
    expect(calls[0].params[2]).toBe(true);
  });
});

describe("priorOperation / rememberOperation", () => {
  it("returns null for a new key", async () => expect(await priorOperation(makeTx().tx, "k", "U-1", { a: 1 })).toBeNull());
  it("replays a stored response for the same user and payload", async () => {
    const { tx } = makeTx((text) => (text.includes("product_stock_requests") ? { rows: [{ user_id: "U-1", same: true, response: { id: 7 } }] } : { rows: [] }));
    expect(await priorOperation(tx, "k", "U-1", { a: 1 })).toEqual({ id: 7, replayed: true });
  });
  it("409 for a different payload", async () => {
    const { tx } = makeTx((t) => (t.includes("product_stock_requests") ? { rows: [{ user_id: "U-1", same: false, response: {} }] } : { rows: [] }));
    expect((await rejects(priorOperation(tx, "k", "U-1", { a: 2 }))).status).toBe(409);
  });
  it("409 for a different user", async () => {
    const { tx } = makeTx((t) => (t.includes("product_stock_requests") ? { rows: [{ user_id: "U-2", same: true, response: {} }] } : { rows: [] }));
    expect((await rejects(priorOperation(tx, "k", "U-1", { a: 1 }))).message).toContain("different stock request");
  });
  it("rememberOperation stores payload and response as JSON", async () => {
    const { tx, calls } = makeTx();
    await rememberOperation(tx, "k", "U-1", { a: 1 }, { ok: true });
    expect(calls[0].params).toEqual(["k", "U-1", '{"a":1}', '{"ok":true}']);
  });
});
