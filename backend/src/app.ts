import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { ENV } from "./config/env.js";
import { HttpError } from "./utils/http.js";
import authRouter from "./routes/auth.route.js";
import ownerRouter from "./routes/owner.route.js";
import salesRouter from "./routes/sales.route.js";
import productionRouter from "./routes/production.route.js";
import sharedRouter from "./routes/shared.route.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // backend/dist
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

export function buildApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({ origin: ENV.CORS_ORIGIN.length ? ENV.CORS_ORIGIN : false }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/shared", sharedRouter);
  app.use("/api/owner", ownerRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/production", productionRouter);
  app.use("/api", (_req, res) => res.status(404).json({ message: "Not found" })); // typo'd API URL = real 404

  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    // SPA fallback: GET only, never /api
    if (req.method !== "GET") return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });

  // Express 5 forwards async errors here automatically
  app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  });
  return app;
}
