import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { login, logout } from "../controllers/auth/postRequests.controller.js";
import { updatePreferences } from "../controllers/auth/updateRequests.controller.js";
import { me } from "../controllers/auth/getRequests.controller.js";

const router = Router();
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, me);
router.patch("/preferences", authMiddleware, updatePreferences);
export default router;
