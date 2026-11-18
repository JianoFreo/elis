import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sql } from "../../config/db.js";
import { ENV } from "../../config/env.js";
import type { Login as L } from "./dto/post.dto.js";

export async function login(req: Request<{}, L.response | L.error, L.body>, res: Response<L.response | L.error>) {
  const { username, password } = req.body ?? ({} as L.body);
  if (!username || !password) return res.status(400).json({ message: "Username and password are required" });

  const [row] = await sql`
    SELECT u.user_id, u.username, u.full_name, u.role, u.branch_id, u.password_hash, u.account_status,
           b.name AS branch
      FROM users u LEFT JOIN branches b ON b.id = u.branch_id
     WHERE u.username = ${username} OR u.email = ${username}`;
  if (!row || !(await bcrypt.compare(password, row.password_hash)))
    return res.status(401).json({ message: "Invalid credentials" });
  if (!row.account_status) return res.status(403).json({ message: "Account is deactivated" });

  await sql`UPDATE users SET active = TRUE, last_login = now() WHERE user_id = ${row.user_id}`;

  const token = jwt.sign({ user_id: row.user_id }, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  const { password_hash, account_status, ...safe } = row;
  res.json({ message: "Login successful", token, user: safe as L.response["user"] });
}

export async function logout(req: Request, res: Response) {
  await sql`UPDATE users SET active = FALSE WHERE user_id = ${req.user!.user_id}`;
  res.json({ message: "Logged out" });
}
