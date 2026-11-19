import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import type { Branches, Products, Materials } from "./dto/get.dto.js";

export async function branches(_req: Request, res: Response<Branches.response>) {
  res.json({ branches: await sql`SELECT id, name, kind FROM branches ORDER BY kind DESC, id` as Branches.response["branches"] });
}

export async function products(_req: Request, res: Response<Products.response>) {
  res.json({ products: await sql`SELECT product_code, name, price::float AS price, threshold FROM products WHERE active ORDER BY product_code` as Products.response["products"] });
}

export async function materials(_req: Request, res: Response<Materials.response>) {
  res.json({ materials: await sql`SELECT material_code, name, unit, cost::float AS cost, threshold::float AS threshold, supplier FROM materials WHERE active ORDER BY material_code` as Materials.response["materials"] });
}
