import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as l from "../controllers/shared/lookup.controller.js";

// Read-only lookups any signed-in role needs for dropdowns.
const router = Router();
router.use(authMiddleware);
router.get("/branches", l.branches);
router.get("/products", l.products);
router.get("/materials", l.materials);
export default router;
