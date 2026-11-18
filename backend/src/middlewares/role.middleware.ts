import type { Request, Response, NextFunction } from "express";

export const requireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) =>
  req.user && roles.includes(req.user.role) ? next() : res.status(403).json({ message: "Forbidden" });

export const ownerOnly = requireRole("owner");
export const salesOnly = requireRole("sales-staff", "owner");
export const productionOnly = requireRole("production-head", "production-staff", "owner");
