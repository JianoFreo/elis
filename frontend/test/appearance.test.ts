import { describe, it, expect, vi, afterEach } from "vitest";
import {
  THEMES, GRADIENTS, DEFAULT_APPEARANCE, hexToRgb, rgbToHex, rgbToHsl, hslToHex, hsvToHex, hexToHsv, contrast,
  isCustomTheme, isCustomGradient, customTheme, customGradient, isHex, deriveTheme, themeOf, stopsOf, backdropOf,
  normalize, applyAppearance, applySavedAppearance,
} from "../src/lib/appearance";

afterEach(() => vi.unstubAllGlobals());

describe("colour conversion", () => {
  it("hex <-> rgb", () => {
    expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
    expect(rgbToHex(255, 128, 0)).toBe("#ff8000");
  });
  it("rgbToHex clamps and rounds", () => expect(rgbToHex(300, -5, 127.6)).toBe("#ff0080"));
  it("rgbToHsl of primaries and grey", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 1, 0.5]);
    expect(rgbToHsl(0, 0, 255)[0]).toBeCloseTo(240);
    expect(rgbToHsl(128, 128, 128)[1]).toBe(0);
  });
  it.each(["#ff0000", "#12ab9f", "#ffffff", "#000000", "#7fc4ff"])("hsl round-trips %s", (hex) =>
    expect(hslToHex(...rgbToHsl(...hexToRgb(hex)))).toBe(hex));
  it.each(["#ff0000", "#12ab9f", "#ffffff", "#336699"])("hsv round-trips %s", (hex) =>
    expect(hsvToHex(...hexToHsv(hex))).toBe(hex));
});

describe("contrast", () => {
  it("black on white is 21", () => expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1));
  it("is symmetric and 1 for identical colours", () => {
    expect(contrast("#123456", "#abcdef")).toBeCloseTo(contrast("#abcdef", "#123456"));
    expect(contrast("#777777", "#777777")).toBe(1);
  });
});

describe("custom colour ids", () => {
  it("validators", () => {
    expect(isCustomTheme("custom:#aabbcc")).toBe(true);
    expect(isCustomTheme("custom:#AABBCC")).toBe(false);
    expect(isCustomTheme(5)).toBe(false);
    expect(isCustomGradient("custom:#aabbcc,#112233")).toBe(true);
    expect(isCustomGradient("custom:#aabbcc")).toBe(false);
    expect(isHex("#AABBCC")).toBe(true);
    expect(isHex("#abc")).toBe(false);
  });
  it("builders lowercase", () => {
    expect(customTheme("#AABBCC")).toBe("custom:#aabbcc");
    expect(customGradient("#AABBCC", "#112233")).toBe("custom:#aabbcc,#112233");
  });
});

describe("deriveTheme", () => {
  it.each(["#000000", "#ffffff", "#ff0000", "#0000ff", "#336699", "#ffd166", "#101010"])(
    "keeps text legible for %s", (hex) => {
      const t = deriveTheme(hex);
      expect(contrast("#1d1626", t.pink)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.pinkDark, t.pinkSoft)).toBeGreaterThanOrEqual(4.5);
      expect(t.label).toBe("Custom");
    });
});

describe("themeOf / stopsOf / backdropOf", () => {
  it("presets resolve to themselves", () => {
    expect(themeOf("mint")).toBe(THEMES.mint);
    expect(stopsOf("ocean")).toBe(GRADIENTS.ocean.stops);
  });
  it("unknown ids fall back to defaults", () => {
    expect(themeOf("nope")).toBe(THEMES.peach);
    expect(stopsOf("nope")).toBe(GRADIENTS.sunset.stops);
  });
  it("custom ids are derived", () => {
    expect(themeOf("custom:#336699").pink).toMatch(/^#[0-9a-f]{6}$/);
    const s = stopsOf("custom:#336699,#cc3366");
    expect(s).toHaveLength(4);
    s.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });
  it("custom backdrop stays light enough for dark text", () => {
    stopsOf("custom:#000000,#000000").forEach((c) => expect(contrast("#1d1626", c)).toBeGreaterThan(4.5));
  });
  it("backdropOf builds a linear gradient from the stops", () => {
    const [a, b, c, d] = GRADIENTS.sunset.stops;
    expect(backdropOf("sunset")).toBe(`linear-gradient(115deg, ${a} 0%, ${b} 38%, ${c} 78%, ${d} 100%)`);
  });
});

describe("normalize", () => {
  it("keeps valid values", () =>
    expect(normalize({ theme: "lilac", gradient: "custom:#aabbcc,#112233" })).toEqual({
      theme: "lilac", gradient: "custom:#aabbcc,#112233",
    }));
  it.each([null, undefined, {}, { theme: 1, gradient: {} }, { theme: "bad", gradient: "bad" }])(
    "defaults for %j", (raw) => expect(normalize(raw as never)).toEqual(DEFAULT_APPEARANCE));
});

describe("applying to the document", () => {
  const fakeDoc = () => {
    const props: Record<string, string> = {};
    vi.stubGlobal("document", { documentElement: { style: { setProperty: (k: string, v: string) => (props[k] = v) } } });
    return props;
  };
  it("applyAppearance sets CSS variables", () => {
    const props = fakeDoc();
    applyAppearance({ theme: "sky", gradient: "mist" });
    expect(props["--color-pink"]).toBe(THEMES.sky.pink);
    expect(props["--color-pink-dark"]).toBe(THEMES.sky.pinkDark);
    expect(props["--color-pink-soft"]).toBe(THEMES.sky.pinkSoft);
    expect(props["--backdrop"]).toBe(backdropOf("mist"));
  });
  it("applySavedAppearance reads the stored user", () => {
    const props = fakeDoc();
    vi.stubGlobal("sessionStorage", { getItem: () => JSON.stringify({ theme: "mint", gradient: "dusk" }) });
    applySavedAppearance();
    expect(props["--color-pink"]).toBe(THEMES.mint.pink);
  });
  it("applySavedAppearance falls back on corrupt storage", () => {
    const props = fakeDoc();
    vi.stubGlobal("sessionStorage", { getItem: () => "{not json" });
    applySavedAppearance();
    expect(props["--color-pink"]).toBe(THEMES.peach.pink);
  });
});
