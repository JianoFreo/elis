import { describe, it, expect } from "vitest";
import { peso, num, fmtDate, fmtTime, fmtDateTime, shortDay, signed } from "../src/lib/format";

describe("peso", () => {
  it.each([[null], [undefined], [""]])("shows a dash for %j", (v) => expect(peso(v as never)).toBe("-"));
  it("formats whole and decimal amounts", () => {
    expect(peso(1234)).toBe("₱1,234");
    expect(peso("1234.5")).toBe("₱1,234.5");
    expect(peso(0)).toBe("₱0");
    expect(peso(1.239)).toBe("₱1.24");
  });
});

describe("num", () => {
  it("dash for empty", () => expect(num(null)).toBe("-"));
  it("respects digits", () => {
    expect(num(1234.5678)).toBe("1,234.57");
    expect(num(1.23456, 3)).toBe("1.235");
    expect(num(5, 0)).toBe("5");
  });
});

describe("dates", () => {
  it("fmtDate handles date-only strings", () => expect(fmtDate("2026-11-08")).toBe("08 Nov 2026"));
  it("fmtDate converts timestamps to Manila time", () => {
    expect(fmtDate("2026-11-07T17:00:00Z")).toBe("08 Nov 2026");
    expect(fmtDate("2026-11-07T15:00:00Z")).toBe("07 Nov 2026");
  });
  it("fmtDate fallbacks", () => {
    expect(fmtDate(null)).toBe("-");
    expect(fmtDate("")).toBe("-");
    expect(fmtDate("not a date")).toBe("not a date");
  });
  it("fmtTime uses 24h Manila time", () => {
    expect(fmtTime("2026-11-08T01:05:00Z")).toBe("09:05");
    expect(fmtTime(undefined)).toBe("-");
  });
  it("fmtDateTime joins both", () => {
    expect(fmtDateTime("2026-11-08T01:05:00Z")).toBe("08 Nov 2026, 09:05");
    expect(fmtDateTime(null)).toBe("-");
  });
  it("shortDay gives the weekday", () => expect(shortDay("2026-11-08")).toBe("Sun"));
});

describe("signed", () => {
  it("prefixes positives only", () => {
    expect(signed(3)).toBe("+3");
    expect(signed(0)).toBe("0");
    expect(signed(-2)).toBe("-2");
  });
});
