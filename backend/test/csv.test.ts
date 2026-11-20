import { describe, it, expect, vi } from "vitest";
import { toCsv, sendCsv } from "../src/utils/csv.js";

describe("toCsv", () => {
  it("returns an empty string for no rows", () => expect(toCsv([])).toBe(""));
  it("writes header and rows", () =>
    expect(toCsv([{ a: 1, b: "x" }, { a: 2, b: "y" }])).toBe("a,b\n1,x\n2,y"));
  it("renders null/undefined as empty", () => expect(toCsv([{ a: null, b: undefined }])).toBe("a,b\n,"));
  it("quotes commas, quotes and newlines", () =>
    expect(toCsv([{ a: 'he said "hi"', b: "x,y", c: "l1\nl2" }])).toBe('a,b,c\n"he said ""hi""","x,y","l1\nl2"'));
});

describe("sendCsv", () => {
  it("sets download headers and sends the body", () => {
    const res = { setHeader: vi.fn(), send: vi.fn() };
    sendCsv(res as never, "report", [{ a: 1 }]);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv; charset=utf-8");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="report.csv"');
    expect(res.send).toHaveBeenCalledWith("a\n1");
  });
});
