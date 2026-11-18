import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        role: string;
        branch_id: number | null;
        [k: string]: unknown;
      };
    }
  }
}
