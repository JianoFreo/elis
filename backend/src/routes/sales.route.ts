import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { salesOnly } from "../middlewares/role.middleware.js";
import * as get from "../controllers/sales/getRequests.controller.js";
import * as post from "../controllers/sales/postRequests.controller.js";

// Sales staff work on their own branch; the owner passes ?branch_id= to look at any branch.
const router = Router();
router.use(authMiddleware, salesOnly);

router.get("/workspace", get.workspace);
router.get("/sales", get.listSales);
router.post("/sales", post.recordSale);
router.get("/queue", get.listQueue);
router.post("/sync", post.syncQueue);
router.get("/closing/count", get.closingCount);
router.post("/closing", post.submitClosing);
router.get("/summary", get.dailySummary);
router.get("/dispatches/incoming", get.incomingDispatches);
router.post("/dispatches/:code/receive", post.receiveDispatch);
export default router;
