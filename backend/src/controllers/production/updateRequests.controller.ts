import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { withTx } from "../../utils/tx.js";
import { bad, notFound, HttpError } from "../../utils/http.js";
import { activity, amount, text, validDate, whole } from "../../utils/domain.js";
import { logActivity } from "../../utils/activityLogger.js";
import type { UpdateProductMaster, UpdateMaterial } from "./dto/update.dto.js";

export async function updateProductMaster(
  req: Request<{ code: string }> | Request<{ product_code: string }>,
  res: Response<UpdateProductMaster.response>,
) {
  const code = "code" in req.params ? req.params.code : req.params.product_code;
  const b = req.body ?? {},
    patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = text(b.name, "name", 120);
  if (b.description !== undefined) {
    if (
      b.description !== null &&
      (typeof b.description !== "string" || b.description.length > 2000)
    )
      throw bad("description must be text up to 2000 characters");
    patch.description = b.description;
  }
  if (b.price !== undefined) patch.price = amount(b.price, "price");
  if (b.cost !== undefined) patch.cost = amount(b.cost, "cost");
  if (b.threshold !== undefined)
    patch.threshold = whole(b.threshold, "threshold", true);
  if (b.best_before !== undefined)
    patch.best_before =
      b.best_before === null || b.best_before === ""
        ? null
        : validDate(b.best_before, "best_before");
  if (b.active !== undefined) {
    if (req.user!.role !== "owner")
      throw new HttpError(403, "Only the owner can change product status");
    if (typeof b.active !== "boolean")
      throw bad("active must be true or false");
    patch.active = b.active;
  }
  if (!Object.keys(patch).length)
    throw bad("Provide at least one editable product field");
  await withTx(async (c) => {
    const p = (
      await c.query(
        `SELECT id FROM products WHERE product_code=$1 FOR UPDATE`,
        [code],
      )
    ).rows[0];
    if (!p) throw notFound("Product not found");
    const columns = Object.keys(patch).filter((k) => k !== "best_before");
    if (columns.length)
      await c.query(
        `UPDATE products SET ${columns.map((k, i) => `"${k}"=$${i + 2}`).join(",")},updated_at=now() WHERE id=$1`,
        [p.id, ...columns.map((k) => patch[k])],
      );
    if ("best_before" in patch)
      await c.query(
        `UPDATE product_batches SET best_before=$2::date WHERE id=(SELECT id FROM product_batches WHERE product_id=$1 ORDER BY id DESC LIMIT 1)`,
        [p.id, patch.best_before],
      );
    await activity(c, req.user!.user_id, "product.update", "product", code);
  });
  res.json({ message: "Product saved" });
}

export async function updateMaterial(req: Request<{ code: string }>, res: Response<UpdateMaterial.response>) {
  const b = req.body ?? {};
  const rows = await sql`
    UPDATE materials SET name = COALESCE(${b.name ?? null}, name), category = COALESCE(${b.category ?? null}, category),
           unit = COALESCE(${b.unit ?? null}, unit), cost = COALESCE(${b.cost ?? null}, cost),
           threshold = COALESCE(${b.threshold ?? null}, threshold), supplier = COALESCE(${b.supplier ?? null}, supplier), updated_at = now()
     WHERE material_code = ${req.params.code} RETURNING material_code`;
  if (!rows.length) throw notFound("Material not found");
  await logActivity(req.user!.user_id, "material.update", "success", { type: "material", id: req.params.code });
  res.json({ message: "Material saved" });
}
