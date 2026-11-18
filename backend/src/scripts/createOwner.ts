import bcrypt from "bcryptjs";
import { sql, pool } from "../config/db.js";

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const email = process.env.ADMIN_EMAIL ?? `${username}@example.com`;
if (!username || !password) throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD");

const hash = await bcrypt.hash(password, 10);
await sql`INSERT INTO users (username, password_hash, full_name, email, role)
          VALUES (${username}, ${hash}, 'Business Owner', ${email}, 'owner')
          ON CONFLICT (username) DO NOTHING`;
console.log("Owner account ready:", username);
await pool.end();
