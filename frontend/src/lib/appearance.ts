// Appearance presets. The ids must match backend/src/utils/appearance.ts (the server stores only the id).
// Each theme keeps dark text on its accent at 4.5:1 or better, and its dark shade readable on its soft tint.

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
export interface Appearance { theme: ThemeId; gradient: GradientId }

export const DEFAULT_APPEARANCE: Appearance = { theme: "peach", gradient: "sunset" };

export const backdropOf = (g: GradientId) => {
  const [a, b, c, d] = GRADIENTS[g].stops;
  return `linear-gradient(115deg, ${a} 0%, ${b} 38%, ${c} 78%, ${d} 100%)`;
};

const isTheme = (v: unknown): v is ThemeId => typeof v === "string" && v in THEMES;
const isGradient = (v: unknown): v is GradientId => typeof v === "string" && v in GRADIENTS;

/** Accepts anything (a stored user, an API reply) and falls back to the defaults for unknown values. */
export function normalize(raw: { theme?: unknown; gradient?: unknown } | null | undefined): Appearance {
  return {
    theme: isTheme(raw?.theme) ? raw.theme : DEFAULT_APPEARANCE.theme,
    gradient: isGradient(raw?.gradient) ? raw.gradient : DEFAULT_APPEARANCE.gradient,
  };
}

/** Writes the chosen palette into the CSS variables the whole app is styled from. */
export function applyAppearance(a: Appearance) {
  const t = THEMES[a.theme];
  const root = document.documentElement.style;
  root.setProperty("--color-pink", t.pink);
  root.setProperty("--color-pink-dark", t.pinkDark);
  root.setProperty("--color-pink-soft", t.pinkSoft);
  root.setProperty("--backdrop", backdropOf(a.gradient));
}

/** Applies the signed-in user's saved appearance (kept in sessionStorage from login), or the default. */
export function applySavedAppearance() {
  try {
    applyAppearance(normalize(JSON.parse(sessionStorage.getItem("user") ?? "{}")));
  } catch {
    applyAppearance(DEFAULT_APPEARANCE);
  }
}
