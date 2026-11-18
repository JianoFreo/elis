import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sql } from "../config/db.js";
import { ENV } from "../config/env.js";

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token" });
  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as { user_id: string };
    const [user] = await sql`SELECT user_id, username, full_name, role, branch_id, account_status
                             FROM users WHERE user_id = ${payload.user_id}`;
    if (!user || !user.account_status) return res.status(401).json({ message: "Account unavailable" });
    req.user = user as Request["user"];
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
