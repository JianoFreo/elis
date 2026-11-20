// Appearance options a user can save. The colour values live in the frontend (frontend/src/lib/appearance.ts);
// the server only needs to know which ids are valid, so it never stores free-form text.
export const THEME_IDS = ["peach", "lilac", "mint", "sky", "butter"] as const;
export const GRADIENT_IDS = ["sunset", "ocean", "blush", "aurora", "dusk", "mist"] as const;

export type ThemeId = (typeof THEME_IDS)[number];
export type GradientId = (typeof GRADIENT_IDS)[number];

export const isTheme = (v: unknown): v is ThemeId => THEME_IDS.includes(v as ThemeId);
export const isGradient = (v: unknown): v is GradientId => GRADIENT_IDS.includes(v as GradientId);
