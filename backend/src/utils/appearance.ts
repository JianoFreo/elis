// Appearance options a user can save. The colour values live in the frontend (frontend/src/lib/appearance.ts);
// the server only needs to know which ids are valid, so it never stores free-form text.
export const THEME_IDS = ["peach", "lilac", "mint", "sky", "butter"] as const;
export const GRADIENT_IDS = ["sunset", "ocean", "blush", "aurora", "dusk", "mist"] as const;

export type ThemeId = (typeof THEME_IDS)[number];
export type GradientId = (typeof GRADIENT_IDS)[number];

// A user may also pick any colour on the wheel. It is stored as lowercase hex, and only in these exact shapes
// (22 characters at most, so they fit the VARCHAR(30) columns): "custom:#rrggbb" and "custom:#rrggbb,#rrggbb".
const CUSTOM_THEME = /^custom:#[0-9a-f]{6}$/;
const CUSTOM_GRADIENT = /^custom:#[0-9a-f]{6},#[0-9a-f]{6}$/;

export const isTheme = (v: unknown): v is string =>
  typeof v === "string" && (THEME_IDS.includes(v as ThemeId) || CUSTOM_THEME.test(v));
export const isGradient = (v: unknown): v is string =>
  typeof v === "string" && (GRADIENT_IDS.includes(v as GradientId) || CUSTOM_GRADIENT.test(v));
