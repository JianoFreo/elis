import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ client: { query: vi.fn(), release: vi.fn() }, connect: vi.fn(), sql: vi.fn() }));
vi.mock("../src/config/env.js", () => ({ ENV: { BUSINESS_DATE: "2026-11-08" } }));
vi.mock("../src/config/db.js", () => ({ pool: { connect: mocks.connect }, sql: mocks.sql }));

import { withTx } from "../src/utils/tx.js";
import { logActivity } from "../src/utils/activityLogger.js";

beforeEach(() => {
  mocks.client.query.mockReset().mockResolvedValue({ rows: [] });
  mocks.client.release.mockReset();
  mocks.connect.mockReset().mockResolvedValue(mocks.client);
  mocks.sql.mockReset().mockResolvedValue([]);
});

const sqlOf = () => mocks.client.query.mock.calls.map((c) => c[0]);

describe("withTx", () => {
  it("begins, commits, releases and returns the result", async () => {
    await expect(withTx(async () => 42)).resolves.toBe(42);
    expect(sqlOf()).toEqual(["BEGIN", "COMMIT"]);
    expect(mocks.client.release).toHaveBeenCalledOnce();
  });
  it("hands the client to the callback", async () => {
    await withTx(async (c) => { await c.query("SELECT 1"); });
    expect(sqlOf()).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
  });
  it("rolls back, releases and rethrows on error", async () => {
    await expect(withTx(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(sqlOf()).toEqual(["BEGIN", "ROLLBACK"]);
    expect(mocks.client.release).toHaveBeenCalledOnce();
  });
  it("never commits after a failure", async () => {
    await withTx(async () => { throw new Error("x"); }).catch(() => {});
    expect(sqlOf()).not.toContain("COMMIT");
  });
  it("rolls back if COMMIT itself fails", async () => {
    mocks.client.query.mockImplementation(async (q: string) => {
      if (q === "COMMIT") throw new Error("commit failed");
      return { rows: [] };
    });
    await expect(withTx(async () => 1)).rejects.toThrow("commit failed");
    expect(sqlOf()).toContain("ROLLBACK");
    expect(mocks.client.release).toHaveBeenCalledOnce();
  });
  it("does not run the callback when the connection fails", async () => {
    mocks.connect.mockRejectedValue(new Error("no conn"));
    const fn = vi.fn();
    await expect(withTx(fn)).rejects.toThrow("no conn");
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("logActivity", () => {
  it("runs one insert", async () => {
    await logActivity("U-1", "auth.login", "success");
    expect(mocks.sql).toHaveBeenCalledOnce();
  });
  it("passes user, status, target and JSON metadata as parameters", async () => {
    await logActivity("U-1", "stock.adjust", "blocked", { type: "product", id: "P-1" }, { qty: 3 });
    const [, ...params] = mocks.sql.mock.calls[0];
    expect(params).toEqual(["U-1", "blocked", "product", "P-1", '{"qty":3}', "stock.adjust"]);
  });
  it("uses null target and empty metadata by default", async () => {
    await logActivity("U-1", "auth.login", "success");
    const [, ...params] = mocks.sql.mock.calls[0];
    expect(params).toEqual(["U-1", "success", null, null, "{}", "auth.login"]);
  });
});
