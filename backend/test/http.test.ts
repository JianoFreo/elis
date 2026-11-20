import { describe, it, expect, vi, afterEach } from "vitest";

const env = vi.hoisted(() => ({ BUSINESS_DATE: "" }));
vi.mock("../src/config/env.js", () => ({ ENV: env }));

import { HttpError, bad, notFound, conflict, bizDate, dateParam, branchOf, pad } from "../src/utils/http.js";

afterEach(() => { vi.useRealTimers(); env.BUSINESS_DATE = ""; });

const req = (user: object, query: object = {}, body?: object) => ({ user, query, body }) as never;

describe("HttpError helpers", () => {
  it("carry the right status", () => {
    expect(bad("x")).toBeInstanceOf(HttpError);
    expect([bad("a").status, notFound("b").status, conflict("c").status]).toEqual([400, 404, 409]);
    expect(bad("msg").message).toBe("msg");
  });
});

describe("bizDate / dateParam", () => {
  it("prefers BUSINESS_DATE", () => {
    env.BUSINESS_DATE = "2026-11-08";
    expect(bizDate()).toBe("2026-11-08");
  });
  it("uses Philippine time otherwise", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T17:00:00Z")); // already 2 March in Manila
    expect(bizDate()).toBe("2026-03-02");
  });
  it("dateParam accepts a valid format, else falls back", () => {
    env.BUSINESS_DATE = "2026-11-08";
    expect(dateParam("2026-01-05")).toBe("2026-01-05");
    expect(dateParam("bad")).toBe("2026-11-08");
    expect(dateParam(undefined)).toBe("2026-11-08");
  });
});

describe("branchOf", () => {
  it("locks sales staff to their own branch, ignoring the query", () =>
    expect(branchOf(req({ role: "sales-staff", branch_id: 4 }, { branch_id: "9" }))).toBe(4));
  it("errors for sales staff without a branch", () =>
    expect(() => branchOf(req({ role: "sales-staff" }))).toThrow("no branch assigned"));
  it("owner picks via query or body", () => {
    expect(branchOf(req({ role: "owner" }, { branch_id: "3" }))).toBe(3);
    expect(branchOf(req({ role: "owner" }, {}, { branch_id: 5 }))).toBe(5);
  });
  it.each([undefined, "0", "-1", "1.5", "abc"])("owner with branch_id %j gets 400", (v) =>
    expect(() => branchOf(req({ role: "owner" }, { branch_id: v }))).toThrow("branch_id is required"));
});

describe("pad", () => {
  it("left-pads with zeros", () => {
    expect(pad(7, 4)).toBe("0007");
    expect(pad(12345, 4)).toBe("12345");
  });
});
