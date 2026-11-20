import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("../src/config/env.js", () => ({ ENV: { JWT_SECRET: "test-secret" } }));
vi.mock("../src/config/db.js", () => ({ sql: mocks.sql }));

import { authMiddleware } from "../src/middlewares/auth.middleware.js";
import { requireRole, ownerOnly, salesOnly, productionOnly } from "../src/middlewares/role.middleware.js";

const makeRes = () => {
  const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
    status: vi.fn(), json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};
const sign = (payload: object, secret = "test-secret", opts: jwt.SignOptions = {}) => jwt.sign(payload, secret, opts);
const run = async (authorization?: string) => {
  const req = { headers: { authorization } } as never as { user?: unknown; headers: object };
  const res = makeRes();
  const next = vi.fn();
  await authMiddleware(req as never, res as never, next);
  return { req, res, next };
};

beforeEach(() => { mocks.sql.mockReset(); });

describe("authMiddleware", () => {
  it("401 when the header is missing", async () => {
    const { res, next } = await run(undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Missing token" });
    expect(next).not.toHaveBeenCalled();
  });
  it("401 when the scheme is not Bearer", async () => {
    const { res } = await run("Basic abc");
    expect(res.json).toHaveBeenCalledWith({ message: "Missing token" });
  });
  it("401 for a malformed token", async () => {
    const { res, next } = await run("Bearer not.a.jwt");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });
  it("401 for a token signed with another secret", async () => {
    const { res } = await run(`Bearer ${sign({ user_id: "U-1" }, "other")}`);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired token" });
  });
  it("401 for an expired token", async () => {
    const { res } = await run(`Bearer ${sign({ user_id: "U-1" }, "test-secret", { expiresIn: -10 })}`);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired token" });
  });
  it("401 when the user no longer exists", async () => {
    mocks.sql.mockResolvedValue([]);
    const { res, next } = await run(`Bearer ${sign({ user_id: "U-1" })}`);
    expect(res.json).toHaveBeenCalledWith({ message: "Account unavailable" });
    expect(next).not.toHaveBeenCalled();
  });
  it("401 when the account is disabled", async () => {
    mocks.sql.mockResolvedValue([{ user_id: "U-1", account_status: false }]);
    const { res } = await run(`Bearer ${sign({ user_id: "U-1" })}`);
    expect(res.json).toHaveBeenCalledWith({ message: "Account unavailable" });
  });
  it("401 when the database lookup throws", async () => {
    mocks.sql.mockRejectedValue(new Error("db down"));
    const { res, next } = await run(`Bearer ${sign({ user_id: "U-1" })}`);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it("attaches the user and calls next for a valid token", async () => {
    const user = { user_id: "U-1", role: "owner", branch_id: null, account_status: true };
    mocks.sql.mockResolvedValue([user]);
    const { req, res, next } = await run(`Bearer ${sign({ user_id: "U-1" })}`);
    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
  it("looks the user up by the id inside the token", async () => {
    mocks.sql.mockResolvedValue([{ user_id: "U-9", account_status: true }]);
    await run(`Bearer ${sign({ user_id: "U-9" })}`);
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual(["U-9"]);
  });
});

describe("requireRole", () => {
  const check = (mw: ReturnType<typeof requireRole>, role?: string) => {
    const req = { user: role ? { role } : undefined };
    const res = makeRes();
    const next = vi.fn();
    mw(req as never, res as never, next);
    return { res, next };
  };

  it("403 when there is no user", () => {
    const { res, next } = check(ownerOnly);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });
  it("allows a listed role", () => expect(check(requireRole("a", "b"), "b").next).toHaveBeenCalled());
  it("blocks an unlisted role", () => expect(check(requireRole("a"), "b").res.status).toHaveBeenCalledWith(403));
  it("blocks everyone when no roles are given", () => expect(check(requireRole(), "owner").next).not.toHaveBeenCalled());

  it.each([
    ["ownerOnly", ownerOnly, { owner: true, "sales-staff": false, "production-head": false, "production-staff": false }],
    ["salesOnly", salesOnly, { owner: true, "sales-staff": true, "production-head": false, "production-staff": false }],
    ["productionOnly", productionOnly, { owner: true, "sales-staff": false, "production-head": true, "production-staff": true }],
  ])("%s role matrix", (_n, mw, matrix) => {
    for (const [role, allowed] of Object.entries(matrix)) {
      const { next, res } = check(mw, role);
      expect(next.mock.calls.length > 0, `${role}`).toBe(allowed);
      expect(res.status.mock.calls.length > 0, `${role}`).toBe(!allowed);
    }
  });
  it("blocks an unknown role everywhere", () => {
    for (const mw of [ownerOnly, salesOnly, productionOnly]) expect(check(mw, "guest").next).not.toHaveBeenCalled();
  });
});
