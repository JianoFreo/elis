import type { Request } from "express";
import { ENV } from "../config/env.js";

// Throw from any controller; the global handler in app.ts turns it into a JSON response.
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const bad = (msg: string) => new HttpError(400, msg);
export const notFound = (msg: string) => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Today in Philippine time (YYYY-MM-DD), or BUSINESS_DATE when set. */
export function bizDate(): string {
  if (ENV.BUSINESS_DATE) return ENV.BUSINESS_DATE;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function dateParam(v: unknown): string {
  return typeof v === "string" && DATE_RE.test(v) ? v : bizDate();
}

/**
 * Branch a request works on. Sales staff are locked to their own branch.
 * The owner picks one with ?branch_id= (or body.branch_id).
 */
export function branchOf(req: Request): number {
  if (req.user!.role === "sales-staff") {
    if (!req.user!.branch_id) throw bad("Your account has no branch assigned");
    return req.user!.branch_id;
  }
  const raw = req.query.branch_id ?? (req.body as { branch_id?: unknown } | undefined)?.branch_id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw bad("branch_id is required");
  return id;
}

export const pad = (n: number, w: number) => String(n).padStart(w, "0");
