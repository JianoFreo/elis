import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ROLE_HOME, ROLE_LABEL } from "../src/lib/roles";
import { DISPATCH_STATUS, MOVEMENT_LABEL } from "../src/lib/format";
import { api } from "../src/lib/axios";
import { errMsg, currentUser, downloadCsv } from "../src/lib/useApi";

const store = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    clear: () => m.clear(),
    removeItem: (k: string) => void m.delete(k),
  };
};

let session: ReturnType<typeof store>;
const assign = vi.fn();
beforeEach(() => {
  session = store();
  assign.mockReset();
  vi.stubGlobal("sessionStorage", session);
  vi.stubGlobal("window", { location: { assign } });
});
afterEach(() => vi.unstubAllGlobals());

describe("roles", () => {
  it("every role has a home and a label", () => {
    expect(Object.keys(ROLE_HOME).sort()).toEqual(Object.keys(ROLE_LABEL).sort());
  });
  it("homes are absolute paths", () => Object.values(ROLE_HOME).forEach((p) => expect(p).toMatch(/^\/[a-z]+$/)));
  it("both production roles share a home", () => expect(ROLE_HOME["production-head"]).toBe(ROLE_HOME["production-staff"]));
  it("maps owner and sales", () => {
    expect(ROLE_HOME.owner).toBe("/owner");
    expect(ROLE_HOME["sales-staff"]).toBe("/sales");
  });
  it("labels are human readable", () => expect(ROLE_LABEL.owner).toBe("Business Owner"));
});

describe("label tables", () => {
  it("dispatch statuses", () => expect(Object.keys(DISPATCH_STATUS)).toEqual(["in_transit", "received", "receipt_review"]));
  it("movement labels cover the ledger types", () =>
    expect(Object.keys(MOVEMENT_LABEL)).toEqual(
      expect.arrayContaining(["opening_baseline", "production_output", "dispatch_out", "receipt_in", "sale", "adjustment"])));
});

describe("errMsg", () => {
  it("reads the API message", () => expect(errMsg({ response: { data: { message: "Nope" } } })).toBe("Nope"));
  it("falls back when there is no response", () => expect(errMsg(new Error("x"))).toBe("Something went wrong"));
  it("uses a custom fallback", () => expect(errMsg({}, "Failed to load")).toBe("Failed to load"));
  it.each([null, undefined, 5, "str"])("survives %j", (v) => expect(errMsg(v)).toBe("Something went wrong"));
});

describe("currentUser", () => {
  it("returns {} when nobody is signed in", () => expect(currentUser()).toEqual({}));
  it("parses the stored user", () => {
    session.setItem("user", JSON.stringify({ user_id: "U-1", role: "owner" }));
    expect(currentUser().role).toBe("owner");
  });
});

describe("axios interceptors", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reqHandler = (api.interceptors.request as any).handlers[0].fulfilled as (c: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resHandlers = (api.interceptors.response as any).handlers[0] as { fulfilled: (r: any) => any; rejected: (e: any) => any };

  it("adds the bearer token when present", () => {
    session.setItem("token", "abc");
    expect(reqHandler({ headers: {} }).headers.Authorization).toBe("Bearer abc");
  });
  it("adds nothing without a token", () => expect(reqHandler({ headers: {} }).headers.Authorization).toBeUndefined());
  it("passes successful responses through", () => {
    const r = { data: 1 };
    expect(resHandlers.fulfilled(r)).toBe(r);
  });
  it("on 401 clears the session and redirects to login", async () => {
    session.setItem("token", "abc");
    await expect(resHandlers.rejected({ response: { status: 401 }, config: { url: "/api/owner/x" } })).rejects.toBeDefined();
    expect(session.getItem("token")).toBeNull();
    expect(assign).toHaveBeenCalledWith("/login");
  });
  it("a failed login does not redirect", async () => {
    session.setItem("token", "abc");
    await expect(resHandlers.rejected({ response: { status: 401 }, config: { url: "/api/auth/login" } })).rejects.toBeDefined();
    expect(session.getItem("token")).toBe("abc");
    expect(assign).not.toHaveBeenCalled();
  });
  it("other errors are rethrown without redirect", async () => {
    const err = { response: { status: 500 }, config: { url: "/x" } };
    await expect(resHandlers.rejected(err)).rejects.toBe(err);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("downloadCsv", () => {
  it("requests csv as a blob and triggers a download", async () => {
    const click = vi.fn();
    const link: { href?: string; download?: string; click: () => void } = { click };
    vi.stubGlobal("document", { createElement: () => link });
    const createObjectURL = vi.fn(() => "blob:1");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: "blob-data" });

    await downloadCsv("/api/owner/reports", { from: "2026-11-01" }, "sales");

    expect(get).toHaveBeenCalledWith("/api/owner/reports", { params: { from: "2026-11-01", format: "csv" }, responseType: "blob" });
    expect(createObjectURL).toHaveBeenCalledWith("blob-data");
    expect(link.href).toBe("blob:1");
    expect(link.download).toBe("sales.csv");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
    get.mockRestore();
  });
});
