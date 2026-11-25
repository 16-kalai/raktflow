import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { callJobs, campaigns, getDb } from "@raktflow/db";
import { logEvent } from "@raktflow/domain";
import { apiMember } from "@/server/session";

/**
 * Load test (fault injection): releases N synthetic call jobs to the worker
 * pool at once. Workers send them to a mock provider that allows 3 calls at a
 * time, so max_concurrent_calls = 4 produces 429s for NudgeBee to diagnose.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const n = Math.min(60, Math.max(1, Number(new URL(req.url).searchParams.get("count") ?? 20)));
  const db = getDb();
  const [c] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.bankId, member.bank.id), eq(campaigns.status, "active"))).limit(1);
  if (!c) return NextResponse.json({ error: "Campaign is not active" }, { status: 409 });
  const ids = db
    .select({ id: callJobs.id })
    .from(callJobs)
    .where(and(eq(callJobs.campaignId, id), eq(callJobs.simulated, true), eq(callJobs.status, "queued"), sql`${callJobs.nextAttemptAt} > now() + interval '1 day'`))
    .limit(n);
  const released = await db.update(callJobs).set({ nextAttemptAt: new Date() }).where(inArray(callJobs.id, ids)).returning({ id: callJobs.id });
  await logEvent(db, member.bank.id, "ops", member.name, `Load test: ${released.length} test calls released to the worker pool (fault injection)`);
  return NextResponse.json({ released: released.length });
}
