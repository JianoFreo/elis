import { sql } from "../config/db.js";

export async function logActivity(
  userId: string,
  actionName: string,
  status: "success" | "failure" | "blocked",
  target?: { type: string; id: string },
  metadata: Record<string, unknown> = {}
) {
  await sql`
    INSERT INTO activity_logs (user_id, action_id, status, target_type, target_id, metadata)
    SELECT ${userId}, action_id, ${status}, ${target?.type ?? null}, ${target?.id ?? null}, ${JSON.stringify(metadata)}::jsonb
      FROM actions WHERE action_name = ${actionName}`;
}
