import type { Request, Response } from "express";
import { sql } from "../../config/db.js";

export async function me(req: Request, res: Response) {
  const [user] = await sql`
    SELECT u.user_id, u.username, u.full_name, u.role, u.branch_id, b.name AS branch
      FROM users u LEFT JOIN branches b ON b.id = u.branch_id
     WHERE u.user_id = ${req.user!.user_id}`;
  res.json({ user });
}
