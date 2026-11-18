import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { salesOnly } from "../middlewares/role.middleware.js";
import * as c from "../controllers/sales/sales.controller.js";

// Sales staff work on their own branch; the owner passes ?branch_id= to look at any branch.
const router = Router();
router.use(authMiddleware, salesOnly);

router.get("/workspace", c.workspace);
router.get("/sales", c.listSales);
router.post("/sales", c.recordSale);
router.get("/queue", c.listQueue);
router.post("/sync", c.syncQueue);
router.get("/closing/count", c.closingCount);
router.post("/closing", c.submitClosing);
router.get("/summary", c.dailySummary);
router.get("/dispatches/incoming", c.incomingDispatches);
router.post("/dispatches/:code/receive", c.receiveDispatch);
export default router;
