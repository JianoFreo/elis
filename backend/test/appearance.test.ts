import { describe, it, expect } from "vitest";
import { isTheme, isGradient, THEME_IDS, GRADIENT_IDS } from "../src/utils/appearance.js";

describe("isTheme", () => {
  it.each([...THEME_IDS, "custom:#a1b2c3"])("accepts %s", (v) => expect(isTheme(v)).toBe(true));
  it.each(["red", "custom:#A1B2C3", "custom:#abc", "custom:#a1b2c3,#a1b2c3", "", null, 1, undefined])(
    "rejects %j", (v) => expect(isTheme(v)).toBe(false));
});

describe("isGradient", () => {
  it.each([...GRADIENT_IDS, "custom:#a1b2c3,#000000"])("accepts %s", (v) => expect(isGradient(v)).toBe(true));
  it.each(["peach", "custom:#a1b2c3", "custom:#a1b2c3,#zzzzzz", "custom:#a1b2c3,#a1b2c3,#a1b2c3", null, 5])(
    "rejects %j", (v) => expect(isGradient(v)).toBe(false));
});
