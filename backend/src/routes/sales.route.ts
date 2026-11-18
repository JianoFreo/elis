import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { salesOnly } from "../middlewares/role.middleware.js";

// Sales + daily closing module (Princess). Add controllers under controllers/sales/.
const router = Router();
router.use(authMiddleware, salesOnly);
export default router;
