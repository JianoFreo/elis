import type { Request, Response } from "express";
import { sql } from "../../config/db.js";
import { withTx } from "../../utils/tx.js";
import { bad, conflict, notFound, dateParam, bizDate } from "../../utils/http.js";
import { addLedger, hubId, stockOf, productByCode } from "../../utils/stock.js";
import { activeProduct, activity, amount, assertDayOpen, businessTimestamp, lockBranch, manilaDay, priorOperation, rememberOperation, text, validDate, whole } from "../../utils/domain.js";
import { logActivity } from "../../utils/activityLogger.js";
import type { CreateDispatch, RegisterProduct, RecordProduction, StockBaseline, RegisterMaterial, StockIn, LogOpening, LogClosing } from "./dto/post.dto.js";

// Saving a dispatch deducts the hub immediately. The branch is credited only when it confirms receipt.
export async function createDispatch(req: Request, res: Response<CreateDispatch.response>) {
  const { product_code, batch_no, branch_id, quantity } = req.body ?? {};
  const qty = Number(quantity);
  if (!product_code || !Number.isInteger(Number(branch_id)) || !Number.isInteger(qty) || qty <= 0)
    throw bad("product_code, branch_id and a whole quantity above 0 are required");
  const userId = req.user!.user_id;

  const out = await withTx(async (c) => {
    const p = await productByCode(product_code, c);
    const hub = await hubId(c);
    const dest = (await c.query(`SELECT id, kind FROM branches WHERE id = $1`, [Number(branch_id)])).rows[0];
    if (!dest || dest.kind !== "branch") throw bad("Choose a destination branch");
    await c.query(`SELECT pg_advisory_xact_lock($1, $2)`, [hub, p.id]);
    const stock = await stockOf(hub, p.id, c);
    if (qty > stock) throw conflict(`Main hub only has ${stock} ${p.name}`);
    const batch = batch_no
      ? (await c.query(`SELECT id FROM product_batches WHERE product_id = $1 AND batch_no = $2 ORDER BY id DESC LIMIT 1`, [p.id, batch_no])).rows[0]
      : (await c.query(`SELECT id FROM product_batches WHERE product_id = $1 ORDER BY id DESC LIMIT 1`, [p.id])).rows[0];
    if (!batch) throw bad(`Batch ${batch_no ?? ""} not found for ${p.name}`);
    const d = (await c.query(
      `INSERT INTO dispatches (product_id, batch_id, branch_id, quantity_dispatched, status, prepared_by)
       VALUES ($1,$2,$3,$4,'in_transit',$5) RETURNING dispatch_code`, [p.id, batch.id, dest.id, qty, userId])).rows[0];
    await addLedger(c, { product_id: p.id, batch_id: batch.id, branch_id: hub, type: "dispatch_out", qty: -qty, ref: d.dispatch_code, by: userId });
    return { dispatch_code: d.dispatch_code as string, hub_stock_after: stock - qty };
  });
  await logActivity(userId, "dispatch.create", "success", { type: "dispatch", id: out.dispatch_code });
  res.status(201).json(out);
}

export async function registerProduct(req: Request, res: Response<RegisterProduct.response>) {
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

export async function recordProduction(req: Request, res: Response<RecordProduction.response>) {
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

export async function stockBaseline(req: Request, res: Response<StockBaseline.response>) {
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

export async function registerMaterial(req: Request, res: Response<RegisterMaterial.response>) {
  const { name, category = null, unit, cost, threshold, supplier = null } = req.body ?? {};
  if (!name || !unit || Number.isNaN(Number(cost)) || Number.isNaN(Number(threshold))) throw bad("name, unit, cost and threshold are required");
  const [row] = await sql`
    INSERT INTO materials (name, category, unit, cost, threshold, supplier) VALUES (${name}, ${category}, ${unit}, ${Number(cost)}, ${Number(threshold)}, ${supplier})
    RETURNING material_code`;
  await logActivity(req.user!.user_id, "material.update", "success", { type: "material", id: row.material_code });
  res.status(201).json({ message: "Material registered", material_code: row.material_code });
}

export async function stockIn(req: Request, res: Response<StockIn.response>) {
  const { material_code, quantity, unit_cost, supplier = null, received_on, receipt_ref = null } = req.body ?? {};
  const qty = Number(quantity);
  if (!material_code || !(qty > 0)) throw bad("material_code and a quantity above 0 are required");
  const userId = req.user!.user_id;
  const day = received_on ? dateParam(received_on) : bizDate();

  const out = await withTx(async (c) => {
    const m = (await c.query(`SELECT id, cost, supplier FROM materials WHERE material_code = $1`, [material_code])).rows[0];
    if (!m) throw notFound("Material not found");
    const ref = receipt_ref ?? `SUP-${String(((await c.query(`SELECT COALESCE(MAX(SUBSTRING(receipt_ref FROM 5)::int),0)+1 AS n FROM material_stock_in WHERE receipt_ref ~ '^SUP-[0-9]+$'`)).rows[0].n as number)).padStart(4, "0")}`;
    const dup = await c.query(`SELECT 1 FROM material_stock_in WHERE receipt_ref = $1`, [ref]);
    if (dup.rowCount) throw conflict(`Receipt ${ref} already exists`);
    await c.query(
      `INSERT INTO material_stock_in (receipt_ref, material_id, quantity, unit_cost, supplier, received_on, received_by) VALUES ($1,$2,$3,$4,$5,$6::date,$7)`,
      [ref, m.id, qty, unit_cost ?? m.cost, supplier ?? m.supplier, day, userId]);
    // same-day shift record: fold the delivery into it so on-hand is not counted twice
    await c.query(
      `UPDATE material_usage SET received_qty = received_qty + $3, closing_qty = CASE WHEN closing_qty IS NULL THEN NULL ELSE closing_qty + $3 END
        WHERE material_id = $1 AND usage_date = $2::date`, [m.id, day, qty]);
    return { receipt_ref: ref };
  });
  await logActivity(userId, "material.stock_in", "success", { type: "material", id: material_code });
  res.status(201).json(out);
}

// Shift opening: prefilled from the previous verified closing, counted by production staff.
export async function logOpening(req: Request, res: Response<LogOpening.response>) {
  const { material_code, opening_qty, shift = "Morning" } = req.body ?? {};
  const open = Number(opening_qty);
  if (!material_code || !(open >= 0) || opening_qty === "" || opening_qty === null || opening_qty === undefined) throw bad("material_code and an opening quantity are required");
  const userId = req.user!.user_id;
  const date = bizDate();
  const out = await withTx(async (c) => {
    const m = (await c.query(`SELECT id, material_code FROM materials WHERE material_code = $1`, [material_code])).rows[0];
    if (!m) throw notFound("Material not found");
    const hub = await hubId(c);
    const ref = `OPEN-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8)}-${m.material_code}`;
    const dup = await c.query(`SELECT 1 FROM material_usage WHERE record_ref = $1`, [ref]);
    if (dup.rowCount) throw conflict("Opening inventory for this material was already logged today");
    // deliveries already received today are part of the physical opening count
    await c.query(
      `INSERT INTO material_usage (record_ref, usage_date, shift, material_id, branch_id, opening_qty, received_qty, counted_by)
       VALUES ($1,$2::date,$3,$4,$5,$6,0,$7)`, [ref, date, shift, m.id, hub, open, userId]);
    return { record_ref: ref, opening_qty: open };
  });
  await logActivity(userId, "usage.record", "success", { type: "material", id: material_code });
  res.status(201).json(out);
}

export async function logClosing(req: Request, res: Response<LogClosing.response>) {
  const { material_code, closing_qty } = req.body ?? {};
  const close = Number(closing_qty);
  if (!material_code || !(close >= 0) || closing_qty === "" || closing_qty === null || closing_qty === undefined) throw bad("material_code and a closing quantity are required");
  const userId = req.user!.user_id;
  const out = await withTx(async (c) => {
    const rec = (await c.query(
      `SELECT u.id, u.opening_qty::float AS opening, u.received_qty::float AS received, u.closing_qty, m.threshold::float AS threshold, m.name, m.unit
         FROM material_usage u JOIN materials m ON m.id = u.material_id
        WHERE m.material_code = $1 AND u.usage_date = $2::date FOR UPDATE OF u`, [material_code, bizDate()])).rows[0];
    if (!rec) throw notFound("Log the shift opening inventory first");
    if (rec.closing_qty !== null) throw conflict("This material was already closed for today");
    const available = rec.opening + rec.received;
    if (close > available) throw bad(`Closing count cannot exceed the ${available} ${rec.unit} available`);
    const used = +(available - close).toFixed(2);
    await c.query(`UPDATE material_usage SET closing_qty = $2, used_qty = $3, closed_by = $4 WHERE id = $1`, [rec.id, close, used, userId]);
    return { material: rec.name as string, unit: rec.unit as string, used, remaining: close, threshold: rec.threshold as number, low: close <= rec.threshold };
  });
  await logActivity(userId, "usage.record", "success", { type: "material", id: material_code });
  res.json(out);
}
