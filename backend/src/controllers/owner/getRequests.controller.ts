import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import type { GetUsers, GetProducts, GetMaterials } from "./dto/get.dto.js";

export async function getUsers(_req: Request, res: Response<GetUsers.response>) {
  const users = await sql`
    SELECT u.user_id, u.username, u.full_name, u.email, u.role, b.name AS branch,
           u.account_status, u.active, u.last_login
      FROM users u LEFT JOIN branches b ON b.id = u.branch_id
     ORDER BY u.user_id`;
  res.json({ users: users as GetUsers.response["users"] });
}

export async function getProducts(_req: Request, res: Response<GetProducts.response>) {
  const products = await sql`
    SELECT product_code, name, description, price, cost, threshold, active FROM products ORDER BY product_code`;
  res.json({ products: products as GetProducts.response["products"] });
}

export async function getMaterials(_req: Request, res: Response<GetMaterials.response>) {
  const materials = await sql`
    SELECT material_code, name, category, unit, cost, threshold, supplier, active FROM materials ORDER BY material_code`;
  res.json({ materials: materials as GetMaterials.response["materials"] });
}
