import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { productionOnly, requireRole } from "../middlewares/role.middleware.js";
import * as inv from "../controllers/production/inventory.controller.js";
import * as dsp from "../controllers/production/dispatch.controller.js";
import * as sup from "../controllers/production/supplies.controller.js";

// Production head + staff, and the owner. Staff are limited to the supplies logging routes.
const router = Router();
router.use(authMiddleware, productionOnly);

const head = requireRole("production-head", "owner");

// inventory & products
router.post("/products", head, inv.registerProduct);
router.get("/inventory", head, inv.inventory);
router.get("/inventory/:code", head, inv.productLedger);
router.post("/production-output", head, inv.recordProduction);
router.post("/stock-baseline", head, inv.stockBaseline);
router.patch("/products/:code", head, inv.updateProductMaster);

// dispatch
router.get("/dispatches", head, dsp.listDispatches);
router.get("/dispatches/:code", head, dsp.dispatchDetail);
router.post("/dispatches", head, dsp.createDispatch);

// supplies (all production roles)
router.get("/supplies", sup.listSupplies);
router.get("/supplies/usage", sup.listUsage);
router.get("/supplies/alerts", sup.alerts);
router.get("/supplies/opening-prefill", sup.openingPrefill);
router.post("/supplies/stock-in", sup.stockIn);
router.post("/supplies/opening", sup.logOpening);
router.post("/supplies/closing", sup.logClosing);
router.post("/materials", head, sup.registerMaterial);
router.patch("/materials/:code", head, sup.updateMaterial);
export default router;
