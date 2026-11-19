import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { withTx } from "../../utils/tx.js";
import { bad, conflict, notFound, HttpError } from "../../utils/http.js";
import { addLedger, hubId, stockOf } from "../../utils/stock.js";
import {
  activeProduct,
  activity,
  amount,
  assertDayOpen,
  businessTimestamp,
  lockBranch,
  manilaDay,
  priorOperation,
  rememberOperation,
  text,
  validDate,
  whole,
} from "../sales/domain.js";

export async function stockRows(branchId: number | null = null) {
  const rows = await sql`
    WITH grouped AS (
      SELECT p.product_code,p.name AS product,b.name AS location,b.kind,b.id AS location_id,p.id AS product_id,
        pb.batch_no,pb.best_before::text AS best_before,p.threshold,SUM(l.quantity)::int AS qty
      FROM stock_ledger l JOIN products p ON p.id=l.product_id JOIN branches b ON b.id=l.branch_id
      LEFT JOIN product_batches pb ON pb.id=l.batch_id
      WHERE (${branchId}::int IS NULL OR l.branch_id=${branchId}::int)
      GROUP BY p.product_code,p.name,b.name,b.kind,b.id,p.id,pb.batch_no,pb.best_before,p.threshold HAVING SUM(l.quantity)<>0
    ), positions AS (SELECT product_id,branch_id,SUM(quantity)::int AS total FROM stock_ledger GROUP BY product_id,branch_id)
    SELECT g.*,CASE WHEN pos.total<=g.threshold THEN 'Low stock' ELSE 'Healthy' END AS status
      FROM grouped g JOIN positions pos ON pos.product_id=g.product_id AND pos.branch_id=g.location_id
    UNION ALL
    SELECT p.product_code,p.name,b.name,b.kind,b.id,p.id,NULL,NULL,p.threshold,0,'Low stock'
      FROM products p CROSS JOIN branches b WHERE p.active
      AND (${branchId}::int IS NULL OR b.id=${branchId}::int)
      AND ((b.kind='hub' AND NOT EXISTS(SELECT 1 FROM stock_ledger l WHERE l.product_id=p.id AND l.branch_id=b.id))
        OR (EXISTS(SELECT 1 FROM stock_ledger l WHERE l.product_id=p.id AND l.branch_id=b.id)
          AND (SELECT SUM(quantity) FROM stock_ledger l WHERE l.product_id=p.id AND l.branch_id=b.id)=0))
    ORDER BY kind DESC,location_id,product_code,batch_no`;
  return rows as {
    product_code: string;
    product: string;
    location: string;
    kind: string;
    location_id: number;
    product_id: number;
    batch_no: string | null;
    best_before: string | null;
    threshold: number;
    qty: number;
    status: string;
  }[];
}

export async function inventory(_req: Request, res: Response) {
  const rows = await stockRows();
  res.json({
    hub_total: rows
      .filter((r) => r.kind === "hub")
      .reduce((s, r) => s + r.qty, 0),
    branch_total: rows
      .filter((r) => r.kind === "branch")
      .reduce((s, r) => s + r.qty, 0),
    low_stock: new Set(
      rows
        .filter((r) => r.status === "Low stock")
        .map((r) => `${r.location_id}:${r.product_code}`),
    ).size,
    rows,
  });
}

export async function productLedger(
  req: Request<{ code: string }>,
  res: Response,
) {
  const [p] =
    await sql`SELECT id,product_code,name,description,price::float AS price,cost::float AS cost,threshold,active FROM products WHERE product_code=${req.params.code}`;
  if (!p) throw notFound("Product not found");
  const [stock] =
    await sql`SELECT COALESCE(SUM(quantity),0)::int AS qty FROM stock_ledger WHERE product_id=${p.id}`;
  const [batch] =
    await sql`SELECT batch_no,best_before::text AS best_before FROM product_batches WHERE product_id=${p.id} ORDER BY id DESC LIMIT 1`;
  const movements =
    await sql`SELECT l.created_at,l.movement_type,l.quantity,l.reference,b.name AS location,u.full_name AS staff,pb.batch_no
    FROM stock_ledger l JOIN branches b ON b.id=l.branch_id LEFT JOIN users u ON u.user_id=l.recorded_by LEFT JOIN product_batches pb ON pb.id=l.batch_id
    WHERE l.product_id=${p.id} ORDER BY l.created_at DESC,l.id DESC LIMIT 100`;
  res.json({ product: p, on_hand: stock.qty, batch: batch ?? null, movements });
}

export async function registerProduct(req: Request, res: Response) {
  const b = req.body ?? {},
    name = text(b.name, "name", 120),
    price = amount(b.price, "price"),
    cost = amount(b.cost, "cost"),
    threshold = whole(b.threshold ?? 0, "threshold", true);
  const description =
    b.description === null || b.description === undefined
      ? null
      : text(b.description, "description", 2000);
  const out = await withTx(async (c) => {
    await c.query(`SELECT pg_advisory_xact_lock(hashtext($1),-3)`, [
      name.toLowerCase(),
    ]);
    if (
      (
        await c.query(
          `SELECT 1 FROM products WHERE lower(name)=lower($1) AND active`,
          [name],
        )
      ).rows.length
    )
      throw conflict("An active product with this name already exists");
    const p = (
      await c.query(
        `INSERT INTO products (name,description,price,cost,threshold) VALUES ($1,$2,$3,$4,$5) RETURNING product_code`,
        [name, description, price, cost, threshold],
      )
    ).rows[0];
    await activity(
      c,
      req.user!.user_id,
      "product.create",
      "product",
      p.product_code,
    );
    return { message: "Product created", product_code: p.product_code };
  });
  res.status(201).json(out);
}

export async function recordProduction(req: Request, res: Response) {
  const b = req.body ?? {},
    code = text(b.product_code, "product_code", 255),
    batch = text(b.batch_no, "batch_no", 40),
    qty = whole(b.quantity, "quantity");
  const best =
    b.best_before === null ||
    b.best_before === undefined ||
    b.best_before === ""
      ? null
      : validDate(b.best_before, "best_before");
  const at = businessTimestamp();
  if (best && best < manilaDay(at))
    throw bad("Best-before date cannot precede production");
  const key =
      "production:" +
      text(b.request_ref ?? `${code}:${batch}`, "request_ref", 60),
    userId = req.user!.user_id;
  const payload = {
    product_code: code,
    batch_no: batch,
    quantity: qty,
    best_before: best,
  };
  const out = await withTx(async (c) => {
    const prior = await priorOperation(c, key, userId, payload);
    if (prior) return prior;
    const p = await activeProduct(c, code),
      hub = await hubId(c);
    await lockBranch(c, hub);
    await c.query(`SELECT pg_advisory_xact_lock($1,$2)`, [hub, p.id]);
    const batchRow = (
      await c.query(
        `INSERT INTO product_batches (batch_no,product_id,quantity_produced,best_before,recorded_by,created_at)
      VALUES ($1,$2,$3,$4::date,$5,$6::timestamptz) RETURNING id`,
        [batch, p.id, qty, best, userId, at],
      )
    ).rows[0];
    const ref = `PROD-${String(batchRow.id).padStart(6, "0")}`;
    await c.query(`UPDATE product_batches SET production_ref=$2 WHERE id=$1`, [
      batchRow.id,
      ref,
    ]);
    await addLedger(c, {
      product_id: p.id,
      batch_id: batchRow.id,
      branch_id: hub,
      type: "production_output",
      qty,
      ref,
      by: userId,
      at,
    });
    const response = {
      production_ref: ref,
      product: p.name,
      quantity: qty,
      batch_no: batch,
    };
    await activity(c, userId, "production.record", "batch", batch, {
      reference: ref,
    });
    await rememberOperation(c, key, userId, payload, response);
    return response;
  });
  res.status("replayed" in out ? 200 : 201).json(out);
}

/** Initial baseline is allowed only on an empty ledger; external receipts append a new movement. */
export async function stockBaseline(req: Request, res: Response) {
  const b = req.body ?? {},
    code = text(b.product_code, "product_code", 255),
    batch = text(b.batch_no, "batch_no", 40),
    branchId = whole(b.branch_id, "branch_id"),
    qty = whole(b.quantity, "quantity", true),
    mode = b.entry_type ?? "opening";
  if (mode !== "opening" && mode !== "received")
    throw bad("entry_type must be opening or received");
  if (mode === "received" && !qty)
    throw bad("Received quantity must be above zero");
  const reference = text(
      b.reference ?? `BASE-${code}-${batch}-${branchId}`,
      "reference",
      60,
    ),
    key = "stock:" + reference,
    userId = req.user!.user_id;
  const payload = {
    product_code: code,
    batch_no: batch,
    branch_id: branchId,
    quantity: qty,
    entry_type: mode,
  };
  const out = await withTx(async (c) => {
    const prior = await priorOperation(c, key, userId, payload);
    if (prior) return prior;
    await lockBranch(c, branchId);
    const location = (
      await c.query(`SELECT id,kind FROM branches WHERE id=$1`, [branchId])
    ).rows[0];
    if (!location) throw bad("Choose an existing location");
    if (location.kind === "branch")
      await assertDayOpen(c, branchId, manilaDay(businessTimestamp()));
    const p = await activeProduct(c, code);
    await c.query(`SELECT pg_advisory_xact_lock($1,$2)`, [branchId, p.id]);
    if (
      mode === "opening" &&
      (
        await c.query(
          `SELECT 1 FROM stock_ledger WHERE branch_id=$1 AND product_id=$2 LIMIT 1`,
          [branchId, p.id],
        )
      ).rows.length
    )
      throw conflict(
        "This product already has ledger history here. Use received stock, or an owner-approved adjustment; do not add another opening baseline",
      );
    let batchRow = (
      await c.query(
        `SELECT id FROM product_batches WHERE product_id=$1 AND batch_no=$2 ORDER BY id DESC LIMIT 1`,
        [p.id, batch],
      )
    ).rows[0];
    if (!batchRow)
      batchRow = (
        await c.query(
          `INSERT INTO product_batches (batch_no,product_id,quantity_produced,recorded_by,created_at) VALUES ($1,$2,0,$3,$4::timestamptz) RETURNING id`,
          [batch, p.id, userId, businessTimestamp()],
        )
      ).rows[0];
    const before = await stockOf(branchId, p.id, c);
    await addLedger(c, {
      product_id: p.id,
      batch_id: batchRow.id,
      branch_id: branchId,
      type: mode === "opening" ? "opening_baseline" : "receipt_in",
      qty,
      ref: reference,
      by: userId,
      at: businessTimestamp(),
    });
    const response = {
      message: "Stock movement saved",
      reference,
      entry_type: mode,
      quantity: qty,
      stock_before: before,
      stock_after: before + qty,
    };
    await activity(c, userId, "stock.baseline", "product", code, {
      reference,
      entry_type: mode,
    });
    await rememberOperation(c, key, userId, payload, response);
    return response;
  });
  res.status("replayed" in out ? 200 : 201).json(out);
}

export async function updateProductMaster(
  req: Request<{ code: string }> | Request<{ product_code: string }>,
  res: Response,
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
