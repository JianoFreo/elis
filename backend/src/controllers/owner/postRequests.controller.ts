import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { registerProduct } from "../production/inventory.controller.js";
import { sql } from "../../config/db.js";
import { logActivity } from "../../utils/activityLogger.js";
import type { AddProduct as P, AddUser as U } from "./dto/post.dto.js";

const ROLES = ["owner", "sales-staff", "production-head", "production-staff"];

export async function addUser(
  req: Request<{}, U.response | U.error, U.body>,
  res: Response<U.response | U.error>,
) {
  const {
    username,
    password,
    full_name,
    email,
    role,
    branch_id = null,
  } = req.body ?? ({} as U.body);
  if (!username || !password || !full_name || !ROLES.includes(role))
    return res
      .status(400)
      .json({
        message: "username, password, full_name and a valid role are required",
      });
  if (password.length < 8)
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });

  const [dup] =
    await sql`SELECT 1 FROM users WHERE username = ${username} OR (${email ?? null}::text IS NOT NULL AND email = ${email ?? null})`;
  if (dup)
    return res
      .status(409)
      .json({ message: "Username or email already in use" });

  const hash = await bcrypt.hash(password, 10);
  const [row] = await sql`
    INSERT INTO users (username, password_hash, full_name, email, role, branch_id)
    VALUES (${username}, ${hash}, ${full_name}, ${email ?? null}, ${role}, ${branch_id})
    RETURNING user_id`;
  await logActivity(req.user!.user_id, "user.create", "success", {
    type: "user",
    id: row.user_id,
  });
  res.status(201).json({ message: "Account created", user_id: row.user_id });
}

// Product writes share Princess's validation and transactional activity recording.
export async function addProduct(
  req: Request<{}, P.response | P.error, P.body>,
  res: Response<P.response | P.error>,
) {
  return registerProduct(req, res);
}
