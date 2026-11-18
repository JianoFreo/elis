import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { bad, conflict, notFound } from "../../utils/http.js";
import { logActivity } from "../../utils/activityLogger.js";

// Role capabilities shown on the permissions screen. Enforced by the route guards, not stored per user.
const CAPABILITIES = [
  "Overview and reports",
  "Record sales and queue offline",
  "Count stock and submit closing",
  "Confirm branch receipt",
  "Record production and create dispatches",
  "Register materials, receive stock, log usage",
  "Approve inventory adjustments",
  "Weekly audit sign-off",
  "Create or delete accounts",
] as const;

const ROLE_ACCESS: Record<string, boolean[]> = {
  "owner":            [true,  false, false, false, true,  true,  true,  true,  true],
  "sales-staff":      [false, true,  true,  true,  false, false, false, false, false],
  "production-head":  [false, false, false, false, true,  true,  false, false, false],
  "production-staff": [false, false, false, false, false, true,  false, false, false],
};

export async function permissions(req: Request<{ role: string }>, res: Response) {
  const access = ROLE_ACCESS[req.params.role];
  if (!access) throw notFound("Unknown role");
  res.json({ role: req.params.role, permissions: CAPABILITIES.map((capability, i) => ({ capability, allowed: access[i] })) });
}

export async function nextAccountId(_req: Request, res: Response) {
  const [r] = await sql`SELECT 'ACC-' || LPAD((last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::text, 3, '0') AS next FROM user_id_seq`;
  res.json({ user_id: r.next });
}

export async function deleteUser(req: Request<{ user_id: string }>, res: Response) {
  const { user_id } = req.params;
  if (user_id === req.user!.user_id) throw bad("You cannot delete your own account");
  const [u] = await sql`SELECT user_id, role FROM users WHERE user_id = ${user_id}`;
  if (!u) throw notFound("User not found");
  try {
    await sql`DELETE FROM users WHERE user_id = ${user_id}`;
  } catch (e) {
    if ((e as { code?: string }).code === "23503") throw conflict("This account has recorded activity and cannot be deleted. Deactivate it instead.");
    throw e;
  }
  await logActivity(req.user!.user_id, "user.delete", "success", { type: "user", id: user_id });
  res.json({ message: "Account deleted" });
}
