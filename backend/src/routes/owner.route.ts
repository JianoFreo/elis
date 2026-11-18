import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { ownerOnly } from "../middlewares/role.middleware.js";
import { getUsers, getProducts, getMaterials } from "../controllers/owner/getRequests.controller.js";

const router = Router();
router.use(authMiddleware, ownerOnly);
router.get("/users", getUsers);
router.get("/products", getProducts);
router.get("/materials", getMaterials);
export default router;
