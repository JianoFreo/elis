import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { productionOnly } from "../middlewares/role.middleware.js";

// Dispatch, materials, discrepancies module (Jiano). Add controllers under controllers/production/.
const router = Router();
router.use(authMiddleware, productionOnly);
export default router;
