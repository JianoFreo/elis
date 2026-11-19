import type { Request, Response } from "express";
import { updateProductMaster } from "../production/updateRequests.controller.js";
import { sql } from "../../config/db.js";
import { logActivity } from "../../utils/activityLogger.js";
import type {
  SetUserStatus as S,
  UpdateProduct as P,
} from "./dto/update.dto.js";

export async function setUserStatus(
  req: Request<S.params, S.response | S.error, S.body>,
  res: Response<S.response | S.error>,
) {
  const { user_id } = req.params;
  const { account_status } = req.body ?? ({} as S.body);
  if (typeof account_status !== "boolean")
    return res
      .status(400)
      .json({ message: "account_status must be true or false" });
  if (user_id === req.user!.user_id)
    return res
      .status(400)
      .json({ message: "You cannot change your own status" });

  const rows = await sql`
    UPDATE users SET account_status = ${account_status}, active = CASE WHEN ${account_status} THEN active ELSE FALSE END,
           updated_at = now()
     WHERE user_id = ${user_id} RETURNING user_id`;
  if (!rows.length) return res.status(404).json({ message: "User not found" });

  await logActivity(
    req.user!.user_id,
    account_status ? "user.activate" : "user.deactivate",
    "success",
    { type: "user", id: user_id },
  );
  res.json({
    message: account_status ? "Account activated" : "Account deactivated",
  });
}

// Keep the public owner URL, while using the same product validation as the production screen.
export async function updateProduct(
  req: Request<P.params, P.response | P.error, P.body>,
  res: Response<P.response | P.error>,
) {
  return updateProductMaster(req, res);
}
