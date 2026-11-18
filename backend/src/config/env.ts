import dotenv from "dotenv";
dotenv.config();

const required = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
};

export const ENV = {
  PORT: Number(process.env.PORT ?? 5000),
  NODE_ENV: process.env.NODE_ENV ?? "production",
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "1d",
  // comma separated; empty = same-origin only (monolith)
  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? "").split(",").map((s) => s.trim()).filter(Boolean),
};
