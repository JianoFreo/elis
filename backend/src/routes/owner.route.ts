import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { ownerOnly } from "../middlewares/role.middleware.js";
import { getUsers, getProducts, getMaterials } from "../controllers/owner/getRequests.controller.js";
import { addUser, addProduct } from "../controllers/owner/postRequests.controller.js";
import { setUserStatus, updateProduct } from "../controllers/owner/updateRequests.controller.js";
import { deleteProduct } from "../controllers/owner/deleteRequests.controller.js";
import { overview, ownerAlerts } from "../controllers/owner/overview.controller.js";
import * as acc from "../controllers/owner/accounts.controller.js";
import * as dis from "../controllers/owner/discrepancies.controller.js";
import * as aud from "../controllers/owner/audits.controller.js";
import * as rep from "../controllers/owner/reports.controller.js";

const router = Router();
router.use(authMiddleware, ownerOnly);

router.get("/overview", overview);
router.get("/alerts", ownerAlerts);

// accounts
router.get("/users", getUsers);
router.get("/users/next-id", acc.nextAccountId);
router.post("/users", addUser);
router.patch("/users/:user_id/status", setUserStatus);
router.delete("/users/:user_id", acc.deleteUser);
router.get("/permissions/:role", acc.permissions);

// master data
router.get("/products", getProducts);
router.post("/products", addProduct);
router.patch("/products/:product_code", updateProduct);
router.delete("/products/:product_code", deleteProduct);
router.get("/materials", getMaterials);

// discrepancies & adjustments
router.get("/discrepancies", dis.listDiscrepancies);
router.get("/discrepancies/:code", dis.discrepancyDetail);
router.post("/discrepancies/:code/recount", dis.requestRecount);
router.post("/discrepancies/:code/approve-adjustment", dis.approveAdjustment);
router.post("/discrepancies/:code/resolve-delivery", dis.resolveDelivery);
router.post("/closings/:code/confirm", dis.confirmClosing);

// weekly audits
router.get("/audits", aud.listAudits);
router.get("/audits/:code", aud.auditDetail);
router.post("/audits/:code/signoff", aud.signOff);
router.get("/audits/:code/baseline", aud.baselinePreview);
router.post("/audits/:code/baseline", aud.confirmBaseline);

// reports (add ?format=csv to download)
router.get("/reports/daily", rep.dailyReport);
router.get("/reports/stock", rep.stockReport);
router.get("/reports/dispatch", rep.dispatchReport);
router.get("/reports/supply", rep.supplyReport);
export default router;
