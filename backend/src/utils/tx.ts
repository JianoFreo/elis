import type { PoolClient } from "@neondatabase/serverless";
import { pool } from "../config/db.js";

export type Tx = PoolClient;

/** Run `fn` inside one database transaction; rolls back on any error. */
export async function withTx<T>(fn: (c: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
