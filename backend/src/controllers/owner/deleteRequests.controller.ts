import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import type { DeleteProduct as D } from "./dto/delete.dto.js";

// Soft delete: products are kept for history, just switched off.
export async function deleteProduct(req: Request<D.params, D.response | D.error>, res: Response<D.response | D.error>) {
  const rows = await sql`UPDATE products SET active = FALSE WHERE product_code = ${req.params.product_code} RETURNING product_code`;
  if (!rows.length) return res.status(404).json({ message: "Product not found" });
  res.json({ message: "Product deactivated" });
}
