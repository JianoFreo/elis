import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { ownerOnly } from "../middlewares/role.middleware.js";
import { getUsers, getProducts, getMaterials } from "../controllers/owner/getRequests.controller.js";
import { addUser, addProduct } from "../controllers/owner/postRequests.controller.js";
import { setUserStatus, updateProduct } from "../controllers/owner/updateRequests.controller.js";
import { deleteProduct } from "../controllers/owner/deleteRequests.controller.js";

const router = Router();
router.use(authMiddleware, ownerOnly);

router.get("/users", getUsers);
router.post("/users", addUser);
router.patch("/users/:user_id/status", setUserStatus);

router.get("/products", getProducts);
router.post("/products", addProduct);
router.patch("/products/:product_code", updateProduct);
router.delete("/products/:product_code", deleteProduct);

router.get("/materials", getMaterials);
export default router;
