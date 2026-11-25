import { events, type Database } from "@raktflow/db";

export type EventKind = "system" | "forecast" | "campaign" | "call" | "booking" | "flag" | "ops" | "nudgebee";

/** Append to the bank's activity feed (what the dashboard shows live). */
export async function logEvent(
  db: Database,
  bankId: string | null,
  kind: EventKind,
  actor: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await db.insert(events).values({ bankId, kind, actor, message, data: data ?? null });
}
