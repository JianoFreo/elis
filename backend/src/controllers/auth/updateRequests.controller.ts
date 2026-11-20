import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { isGradient, isTheme } from "../../utils/appearance.js";
import type { UpdatePreferences as U } from "./dto/update.dto.js";

// Saves the signed-in user's own appearance. Only a known preset id or a strictly formatted custom colour is accepted.
export async function updatePreferences(
  req: Request<{}, U.response | U.error, U.body>,
  res: Response<U.response | U.error>,
) {
  const { theme, gradient } = req.body ?? ({} as U.body);
  if (theme === undefined && gradient === undefined)
    return res.status(400).json({ message: "Send a theme, a gradient, or both" });
  if (theme !== undefined && !isTheme(theme)) return res.status(400).json({ message: "Unknown theme" });
  if (gradient !== undefined && !isGradient(gradient)) return res.status(400).json({ message: "Unknown gradient" });

  const [row] = await sql`
    UPDATE users SET theme = COALESCE(${theme ?? null}, theme), gradient = COALESCE(${gradient ?? null}, gradient), updated_at = now()
     WHERE user_id = ${req.user!.user_id} RETURNING theme, gradient`;
  res.json({ message: "Appearance saved", preferences: { theme: row.theme, gradient: row.gradient } });
}
