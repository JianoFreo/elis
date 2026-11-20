import { describe, it, expect, vi } from "vitest";

vi.mock("../src/config/env.js", () => ({ ENV: { BUSINESS_DATE: "2026-11-08" } }));
vi.mock("../src/config/db.js", () => ({ sql: vi.fn() }));

const { text, whole, amount, validDate, requestedDate, manilaDay, saleTimestamp, businessTimestamp } =
  await import("../src/utils/domain.js");
const { HttpError } = await import("../src/utils/http.js");

const status = (fn: () => unknown) => {
  try { fn(); } catch (e) { return e instanceof HttpError ? e.status : "other"; }
  return "none";
};

describe("text", () => {
  it("trims and returns valid text", () => expect(text("  hi  ", "Name", 10)).toBe("hi"));
  it.each([["", "empty"], ["   ", "blank"], [null, "null"], [5, "number"], ["x".repeat(11), "too long"]])(
    "rejects %j (%s) with 400", (v) => expect(status(() => text(v, "Name", 10))).toBe(400));
  it("names the field in the message", () =>
    expect(() => text("", "Name", 10)).toThrow("Name is required (maximum 10 characters)"));
});

describe("whole", () => {
  it("accepts numbers and numeric strings", () => {
    expect(whole(3, "Qty")).toBe(3);
    expect(whole("7", "Qty")).toBe(7);
  });
  it("rejects zero unless allowed", () => {
    expect(status(() => whole(0, "Qty"))).toBe(400);
    expect(whole(0, "Qty", true)).toBe(0);
  });
  it.each([-1, 1.5, NaN, Infinity, 2147483648, "", "  ", "abc", null, undefined, {}, true])(
    "rejects %j", (v) => expect(status(() => whole(v, "Qty", true))).toBe(400));
});

describe("amount", () => {
  it("accepts zero and two-decimal values", () => {
    expect(amount(0, "Price")).toBe(0);
    expect(amount("12.34", "Price")).toBe(12.34);
    expect(amount(99999999.99, "Price")).toBe(99999999.99);
  });
  it.each([-0.01, 1.005, 100000000, NaN, Infinity, "", "x", null, undefined])(
    "rejects %j", (v) => expect(status(() => amount(v, "Price"))).toBe(400));
});

describe("validDate", () => {
  it("accepts real dates", () => {
    expect(validDate("2026-11-08")).toBe("2026-11-08");
    expect(validDate("2028-02-29")).toBe("2028-02-29");
  });
  it.each(["2026-02-30", "2026-13-01", "2026-1-1", "11/08/2026", "", 20261108, null])(
    "rejects %j", (v) => expect(status(() => validDate(v))).toBe(400));
  it("uses the label in the error", () => expect(() => validDate("bad", "from")).toThrow("from must be"));
});

describe("business-date helpers", () => {
  it("requestedDate defaults to BUSINESS_DATE", () => expect(requestedDate(undefined)).toBe("2026-11-08"));
  it("requestedDate validates a supplied value", () => {
    expect(requestedDate("2026-01-02")).toBe("2026-01-02");
    expect(status(() => requestedDate("nope"))).toBe(400);
  });
  it("manilaDay converts UTC to the Philippine calendar day", () => {
    expect(manilaDay("2026-11-07T17:00:00Z")).toBe("2026-11-08");
    expect(manilaDay("2026-11-07T15:59:59Z")).toBe("2026-11-07");
  });
  it("businessTimestamp is on BUSINESS_DATE with +08:00", () =>
    expect(businessTimestamp()).toMatch(/^2026-11-08T\d{2}:\d{2}:\d{2}\+08:00$/));
});

describe("saleTimestamp", () => {
  it("defaults to a business timestamp", () => expect(saleTimestamp(undefined)).toMatch(/^2026-11-08T/));
  it("normalises to UTC ISO", () =>
    expect(saleTimestamp("2026-11-08T09:00:00+08:00")).toBe("2026-11-08T01:00:00.000Z"));
  it.each(["2026-11-08", "2026-11-08T09:00:00", "garbage", 5, null])(
    "rejects %j", (v) => expect(status(() => saleTimestamp(v))).toBe(400));
  it("rejects dates after the business date", () =>
    expect(() => saleTimestamp("2026-11-09T09:00:00+08:00")).toThrow("after the current business date"));
  it("allows earlier days", () =>
    expect(saleTimestamp("2026-11-01T09:00:00+08:00")).toBe("2026-11-01T01:00:00.000Z"));
});
