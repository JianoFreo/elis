// Appearance presets plus custom colours. Preset ids must match backend/src/utils/appearance.ts.
// The server stores one short string per choice: a preset id, "custom:#rrggbb" (accent) or "custom:#rrggbb,#rrggbb" (background).

export interface Theme { label: string; pink: string; pinkDark: string; pinkSoft: string }
export interface Gradient { label: string; stops: [string, string, string, string] }

export const THEMES = {
  peach: { label: "Peach", pink: "#ff9f86", pinkDark: "#b8432c", pinkSoft: "#fff0ea" },
  lilac: { label: "Lilac", pink: "#b79cff", pinkDark: "#5b3fc4", pinkSoft: "#f1ebff" },
  mint: { label: "Mint", pink: "#6fd3b0", pinkDark: "#1b6b52", pinkSoft: "#e6f8f1" },
  sky: { label: "Sky", pink: "#7fc4ff", pinkDark: "#1d5a96", pinkSoft: "#e8f3ff" },
  butter: { label: "Butter", pink: "#ffd166", pinkDark: "#7a5200", pinkSoft: "#fff6dc" },
} satisfies Record<string, Theme>;

export const GRADIENTS = {
  sunset: { label: "Sunset", stops: ["#ffc9a8", "#ff8fb3", "#a98bff", "#6a5cff"] },
  ocean: { label: "Ocean", stops: ["#bdf0ff", "#86c5ff", "#8a9bff", "#5b6cff"] },
  blush: { label: "Blush", stops: ["#ffe1c9", "#ffbcd1", "#f0b6ff", "#c59bff"] },
  aurora: { label: "Aurora", stops: ["#c8f7dc", "#8de6d0", "#8fb8ff", "#a58bff"] },
  dusk: { label: "Dusk", stops: ["#ffd9a8", "#ff9f8f", "#d87fb0", "#7a5fc0"] },
  mist: { label: "Mist", stops: ["#eef0f5", "#d9dce6", "#c3c8d8", "#aab1c7"] },
} satisfies Record<string, Gradient>;

export type ThemeId = keyof typeof THEMES;
export type GradientId = keyof typeof GRADIENTS;
/** A preset id or a custom colour string (see the top of this file). */
export interface Appearance { theme: string; gradient: string }

export const DEFAULT_APPEARANCE: Appearance = { theme: "peach", gradient: "sunset" };
const INK = "#1d1626"; // the app's text colour, used for text on the accent

// ---------- colour maths ----------
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const HEX = /^#[0-9a-f]{6}$/;

export function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
export const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");

/** h 0-360, s and l 0-1. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min, l = (max + min) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
export function hslToHex(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
/** h 0-360, s and v 0-1: the model the colour wheel works in (angle = hue, distance = saturation, slider = brightness). */
export function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => v - v * s * Math.max(0, Math.min(1, Math.min((n + h / 60) % 6, 4 - ((n + h / 60) % 6))));
  return rgbToHex(f(5) * 255, f(3) * 255, f(1) * 255);
}
export function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = d === 0 ? 0 : max === r ? (((g - b) / d) % 6) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [(h + 360) % 360, max === 0 ? 0 : d / max, max];
}
function luminance(hex: string) {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hexToRgb(hex).map((v) => f(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const mix = (a: string, b: string, t: number) => {
  const [A, B] = [hexToRgb(a), hexToRgb(b)];
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};

// ---------- custom colours ----------
export const isCustomTheme = (v: unknown): v is string => typeof v === "string" && /^custom:#[0-9a-f]{6}$/.test(v);
export const isCustomGradient = (v: unknown): v is string => typeof v === "string" && /^custom:#[0-9a-f]{6},#[0-9a-f]{6}$/.test(v);
export const customTheme = (hex: string) => `custom:${hex.toLowerCase()}`;
export const customGradient = (a: string, b: string) => `custom:${a.toLowerCase()},${b.toLowerCase()}`;
export const isHex = (v: string) => HEX.test(v.toLowerCase());

/**
 * Builds a full theme from any picked colour. Whatever is picked, dark text on the accent stays at 4.5:1 or better
 * (the accent is lightened if needed) and the accent's dark shade stays readable on its soft tint.
 */
export function deriveTheme(hex: string): Theme {
  const [h, s0, l0] = rgbToHsl(...hexToRgb(hex));
  const s = clamp(s0, 0.35, 1);
  let l = l0;
  let accent = hslToHex(h, s0, l);
  while (contrast(INK, accent) < 4.5 && l < 0.97) { l += 0.02; accent = hslToHex(h, s0, l); }
  const soft = hslToHex(h, clamp(s, 0.4, 1), 0.95);
  let dl = 0.4;
  let dark = hslToHex(h, clamp(s, 0.35, 0.85), dl);
  while (contrast(dark, soft) < 4.5 && dl > 0.08) { dl -= 0.02; dark = hslToHex(h, clamp(s, 0.35, 0.85), dl); }
  return { label: "Custom", pink: accent, pinkDark: dark, pinkSoft: soft };
}

/** Custom backdrop colours are used exactly as picked, black included. */
const softenBackdrop = (hex: string) => hex;

export function themeOf(id: string): Theme {
  if (isCustomTheme(id)) return deriveTheme(id.slice(7));
  return THEMES[(id in THEMES ? id : DEFAULT_APPEARANCE.theme) as ThemeId];
}

export function stopsOf(id: string): [string, string, string, string] {
  if (isCustomGradient(id)) {
    const [a, b] = id.slice(7).split(",").map(softenBackdrop);
    return [a, mix(a, b, 1 / 3), mix(a, b, 2 / 3), b];
  }
  return GRADIENTS[(id in GRADIENTS ? id : DEFAULT_APPEARANCE.gradient) as GradientId].stops;
}

export const backdropOf = (id: string) => {
  const [a, b, c, d] = stopsOf(id);
  return `linear-gradient(115deg, ${a} 0%, ${b} 38%, ${c} 78%, ${d} 100%)`;
};

/** Accepts anything (a stored user, an API reply) and falls back to the defaults for unknown values. */
export function normalize(raw: { theme?: unknown; gradient?: unknown } | null | undefined): Appearance {
  const t = raw?.theme, g = raw?.gradient;
  return {
    theme: typeof t === "string" && (t in THEMES || isCustomTheme(t)) ? t : DEFAULT_APPEARANCE.theme,
    gradient: typeof g === "string" && (g in GRADIENTS || isCustomGradient(g)) ? g : DEFAULT_APPEARANCE.gradient,
  };
}

/** Writes the chosen palette into the CSS variables the whole app is styled from. */
export function applyAppearance(a: Appearance) {
  const t = themeOf(a.theme);
  const root = document.documentElement.style;
  root.setProperty("--color-pink", t.pink);
  root.setProperty("--color-pink-dark", t.pinkDark);
  root.setProperty("--color-pink-soft", t.pinkSoft);
  root.setProperty("--backdrop", backdropOf(a.gradient));
}

// The signed-in user's choice lives in sessionStorage, which is wiped on sign-out. The last choice is also kept
// on this device so the sign-in page can wear the same colours.
const REMEMBER_KEY = "eyk:appearance";

export function rememberAppearance(a: Appearance) {
  try { localStorage.setItem(REMEMBER_KEY, JSON.stringify(a)); } catch { /* storage unavailable */ }
}

function rememberedAppearance(): Appearance {
  try { return normalize(JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? "{}")); } catch { return DEFAULT_APPEARANCE; }
}

/** Applies the last appearance used on this device (what the sign-in page shows), or the default. */
export function applyRememberedAppearance() {
  applyAppearance(rememberedAppearance());
}

/** Applies the signed-in user's saved appearance (kept in sessionStorage from login); with nobody signed in, the remembered one. */
export function applySavedAppearance() {
  try {
    const user = JSON.parse(sessionStorage.getItem("user") ?? "null");
    if (!user) return applyRememberedAppearance();
    const a = normalize(user);
    applyAppearance(a);
    rememberAppearance(a);
  } catch {
    applyAppearance(DEFAULT_APPEARANCE);
  }
}
