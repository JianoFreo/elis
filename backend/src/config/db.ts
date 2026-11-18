import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { ENV } from "./env.js";

neonConfig.webSocketConstructor = ws; // required for Pool on Node < 22

export const sql = neon(ENV.DATABASE_URL); // single statements (HTTP)
export const pool = new Pool({ connectionString: ENV.DATABASE_URL }); // multi-step transactions

export async function connectDb() {
  await sql`SELECT 1`;
  console.log("Database reachable");
}
