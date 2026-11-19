import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { productionOnly, requireRole } from "../middlewares/role.middleware.js";
import * as get from "../controllers/production/getRequests.controller.js";
import * as post from "../controllers/production/postRequests.controller.js";
import * as upd from "../controllers/production/updateRequests.controller.js";

// Production head + staff, and the owner. Staff are limited to the supplies logging routes.
const router = Router();
router.use(authMiddleware, productionOnly);

const head = requireRole("production-head", "owner");

// inventory & products
router.post("/products", head, post.registerProduct);
router.get("/inventory", head, get.inventory);
router.get("/inventory/:code", head, get.productLedger);
router.post("/production-output", head, post.recordProduction);
router.post("/stock-baseline", head, post.stockBaseline);
router.patch("/products/:code", head, upd.updateProductMaster);

// dispatch
router.get("/dispatches", head, get.listDispatches);
router.get("/dispatches/:code", head, get.dispatchDetail);
router.post("/dispatches", head, post.createDispatch);

// supplies (all production roles)
router.get("/supplies", get.listSupplies);
router.get("/supplies/usage", get.listUsage);
router.get("/supplies/alerts", get.alerts);
router.get("/supplies/opening-prefill", get.openingPrefill);
router.post("/supplies/stock-in", post.stockIn);
router.post("/supplies/opening", post.logOpening);
router.post("/supplies/closing", post.logClosing);
router.post("/materials", head, post.registerMaterial);
router.patch("/materials/:code", head, upd.updateMaterial);
export default router;
