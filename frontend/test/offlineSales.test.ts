import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  salesKey, newReference, captureTime, readLocalSales, enqueueSale, removeLocalSale, failLocalSale,
  reservedQuantity, salePayload, type LocalSale, type SalesContext,
} from "../src/lib/offlineSales";

const ctx: SalesContext = { userId: "U-1/x", branchId: 2 };

const makeStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: vi.fn((k: string, v: string) => void m.set(k, v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
};

const sale = (over: Partial<LocalSale> = {}): LocalSale => ({
  local_ref: "L-1", product_code: "P-1", product: "Pie", quantity: 2, unit_price: 50, line_total: 100,
  sold_at: "2026-11-08T09:00:00+08:00", ...over,
});

let storage: Storage;
beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("navigator", {});
});
afterEach(() => vi.unstubAllGlobals());

describe("keys and references", () => {
  it("salesKey encodes the user id", () => expect(salesKey(ctx)).toBe("eyk:sales:v1:U-1%2Fx:2"));
  it("newReference is unique and prefixed", () => {
    const a = newReference(), b = newReference();
    expect(a).toMatch(/^L-/);
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(40);
  });
  it("captureTime is on the given date at +08:00", () =>
    expect(captureTime("2026-11-08")).toMatch(/^2026-11-08T\d{2}:\d{2}:\d{2}\+08:00$/));
});

describe("readLocalSales", () => {
  it("returns [] when nothing is stored", () => expect(readLocalSales(ctx, storage)).toEqual([]));
  it("throws on unparsable data", () => {
    storage.setItem(salesKey(ctx), "{bad");
    expect(() => readLocalSales(ctx, storage)).toThrow("could not be read");
  });
  it.each([
    [{ not: "array" }],
    [[{ ...sale(), quantity: 0 }]],
    [[{ ...sale(), quantity: 1.5 }]],
    [[{ ...sale(), unit_price: "5" }]],
    [[{ ...sale(), local_ref: 1 }]],
    [[null]],
  ])("throws on invalid shape %j", (v) => {
    storage.setItem(salesKey(ctx), JSON.stringify(v));
    expect(() => readLocalSales(ctx, storage)).toThrow("invalid");
  });
});

describe("enqueueSale", () => {
  it("stores a sale and notifies listeners", async () => {
    await enqueueSale(ctx, sale(), storage);
    expect(readLocalSales(ctx, storage)).toEqual([sale()]);
    expect(window.dispatchEvent).toHaveBeenCalled();
  });
  it("is idempotent for the identical sale", async () => {
    await enqueueSale(ctx, sale(), storage);
    await enqueueSale(ctx, sale(), storage);
    expect(readLocalSales(ctx, storage)).toHaveLength(1);
  });
  it("rejects a different sale reusing a reference", async () => {
    await enqueueSale(ctx, sale(), storage);
    await expect(enqueueSale(ctx, sale({ quantity: 9 }), storage)).rejects.toThrow("different sale");
  });
  it.each([
    ["zero quantity", { quantity: 0 }],
    ["fractional quantity", { quantity: 1.5 }],
    ["negative price", { unit_price: -1 }],
    ["NaN price", { unit_price: NaN }],
    ["empty ref", { local_ref: "" }],
    ["long ref", { local_ref: "x".repeat(41) }],
    ["bad date", { sold_at: "nope" }],
  ])("rejects %s", async (_n, over) => {
    await expect(enqueueSale(ctx, sale(over as Partial<LocalSale>), storage)).rejects.toThrow("valid sale");
    expect(readLocalSales(ctx, storage)).toEqual([]);
  });
  it("reports a friendly error when storage is full", async () => {
    (storage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error("quota"); });
    await expect(enqueueSale(ctx, sale(), storage)).rejects.toThrow("could not be saved on this device");
  });
  it("uses navigator.locks when available", async () => {
    const request = vi.fn(async (_k: string, fn: () => void) => fn());
    vi.stubGlobal("navigator", { locks: { request } });
    await enqueueSale(ctx, sale(), storage);
    expect(request).toHaveBeenCalledWith(salesKey(ctx), expect.any(Function));
    expect(readLocalSales(ctx, storage)).toHaveLength(1);
  });
  it("keeps queues separate per user and branch", async () => {
    await enqueueSale(ctx, sale(), storage);
    expect(readLocalSales({ ...ctx, branchId: 3 }, storage)).toEqual([]);
  });
});

describe("removeLocalSale / failLocalSale", () => {
  it("removes by reference", async () => {
    await enqueueSale(ctx, sale({ local_ref: "A" }), storage);
    await enqueueSale(ctx, sale({ local_ref: "B" }), storage);
    await removeLocalSale(ctx, "A", storage);
    expect(readLocalSales(ctx, storage).map((r) => r.local_ref)).toEqual(["B"]);
  });
  it("records an error on one sale only", async () => {
    await enqueueSale(ctx, sale({ local_ref: "A" }), storage);
    await enqueueSale(ctx, sale({ local_ref: "B" }), storage);
    await failLocalSale(ctx, "B", "Out of stock", storage);
    const rows = readLocalSales(ctx, storage);
    expect(rows.find((r) => r.local_ref === "A")?.error).toBeUndefined();
    expect(rows.find((r) => r.local_ref === "B")?.error).toBe("Out of stock");
  });
  it("a failed sale can be re-queued identically (error ignored)", async () => {
    await enqueueSale(ctx, sale(), storage);
    await failLocalSale(ctx, "L-1", "x", storage);
    await expect(enqueueSale(ctx, sale(), storage)).resolves.toBeUndefined();
  });
});

describe("helpers", () => {
  it("reservedQuantity sums per product", () =>
    expect(reservedQuantity([sale({ quantity: 2 }), sale({ local_ref: "2", quantity: 3 }), sale({ local_ref: "3", product_code: "P-2", quantity: 9 })], "P-1")).toBe(5));
  it("salePayload keeps only API fields", () =>
    expect(salePayload(sale())).toEqual({ product_code: "P-1", quantity: 2, local_ref: "L-1", sold_at: "2026-11-08T09:00:00+08:00", offline: false }));
});
