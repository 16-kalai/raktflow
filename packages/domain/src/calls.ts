import { and, eq, lt, sql } from "drizzle-orm";
import { callJobs, callPermits, donors, type Database } from "@raktflow/db";
import { logEvent } from "./events";

export type CallJob = typeof callJobs.$inferSelect;

/**
 * Claims the next call job with a lease. The row lock (SKIP LOCKED) is held
 * only for this short statement, never for the 2-minute call. Jobs whose
 * lease ran out (a pod died mid-call) become claimable again.
 */
export async function claimNextJob(db: Database, workerId: string, leaseSeconds: number): Promise<CallJob | null> {
  const result = await db.execute(sql`
    update ${callJobs} set
      status = 'dialing',
      claimed_by = ${workerId},
      lease_until = now() + make_interval(secs => ${leaseSeconds}),
      attempts = attempts + 1,
      updated_at = now()
    where id = (
      select id from ${callJobs}
      where (status = 'queued' and next_attempt_at <= now())
         or (status in ('dialing', 'in_progress') and lease_until < now())
      order by priority, next_attempt_at
      for update skip locked
      limit 1
    )
    returning id`);
  const id = (result.rows[0] as { id?: string } | undefined)?.id;
  if (!id) return null;
  const [job] = await db.select().from(callJobs).where(eq(callJobs.id, id));
  return job ?? null;
}

/**
 * Global call limit across every worker pod. One row per call in progress;
 * a transaction-scoped advisory lock serialises the count-and-insert.
 */
export async function acquireCallPermit(db: Database, jobId: string, workerId: string, max: number, ttlSeconds: number): Promise<boolean> {
  if (max <= 0) return false;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('raktflow_call_permits'))`);
    await tx.delete(callPermits).where(lt(callPermits.expiresAt, new Date()));
    const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(callPermits);
    if ((row?.n ?? 0) >= max) return false;
    await tx
      .insert(callPermits)
      .values({ jobId, workerId, expiresAt: new Date(Date.now() + ttlSeconds * 1000) })
      .onConflictDoNothing();
    return true;
  });
}

export async function releaseCallPermit(db: Database, jobId: string): Promise<void> {
  await db.delete(callPermits).where(eq(callPermits.jobId, jobId));
}

export async function activeCallCount(db: Database): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(callPermits)
    .where(sql`${callPermits.expiresAt} > now()`);
  return row?.n ?? 0;
}

/** Put a job back in the queue after a retryable failure (e.g. provider 429). */
export async function requeueJob(db: Database, jobId: string, delaySeconds: number, error: string): Promise<void> {
  await db
    .update(callJobs)
    .set({ status: "queued", claimedBy: null, leaseUntil: null, nextAttemptAt: new Date(Date.now() + delaySeconds * 1000), lastError: error })
    .where(eq(callJobs.id, jobId));
}

export async function markDialled(db: Database, jobId: string, attemptId: string): Promise<void> {
  await db.update(callJobs).set({ status: "in_progress", sarvamAttemptId: attemptId }).where(eq(callJobs.id, jobId));
}

export interface CallResult {
  attemptId: string;
  status: string;
  durationSec: number | null;
  interactionId: string | null;
  transcript: { role: "agent" | "user"; text: string }[];
  variables: Record<string, unknown>;
  failureReason: string | null;
}

/** Post-call webhook from Sarvam. Idempotent: replays just overwrite the same row. */
export async function recordCallResult(db: Database, r: CallResult): Promise<CallJob | null> {
  const [job] = await db.select().from(callJobs).where(eq(callJobs.sarvamAttemptId, r.attemptId)).limit(1);
  if (!job) return null;

  const answered = r.status === "connected";
  const v = r.variables;
  const optedOut = String(v.opted_out ?? "").toLowerCase() === "true";
  const deferredDays = Number(v.deferred_days ?? 0);
  const outcome = !answered
    ? r.status === "no_answer" || r.status === "busy"
      ? "no_answer"
      : "failed"
    : job.outcome === "booked"
      ? "booked"
      : optedOut
        ? "opted_out"
        : deferredDays > 0
          ? "deferred"
          : "declined";

  const health = typeof v.health_answers === "object" && v.health_answers ? (v.health_answers as Record<string, string>) : null;
  const [updated] = await db
    .update(callJobs)
    .set({
      status: "completed",
      outcome,
      interactionId: r.interactionId,
      durationSec: r.durationSec,
      transcript: r.transcript,
      healthAnswers: health,
      lastError: r.failureReason,
    })
    .where(eq(callJobs.id, job.id))
    .returning();

  if (optedOut) await db.update(donors).set({ optedOutAt: new Date() }).where(eq(donors.id, job.donorId));
  if (deferredDays > 0) {
    const until = new Date(Date.now() + deferredDays * 86_400_000).toISOString().slice(0, 10);
    await db.update(donors).set({ deferredUntil: until }).where(eq(donors.id, job.donorId));
  }
  await releaseCallPermit(db, job.id);
  await logEvent(db, job.bankId, "call", "sarvam", `Call ${r.status}${r.durationSec ? ` (${r.durationSec}s)` : ""} → ${outcome}`, { jobId: job.id });
  return updated ?? null;
}

export async function findJobForInteraction(db: Database, campaignId: string, donorRef: string): Promise<CallJob | null> {
  const [row] = await db
    .select({ job: callJobs })
    .from(callJobs)
    .innerJoin(donors, eq(donors.id, callJobs.donorId))
    .where(and(eq(callJobs.campaignId, campaignId), eq(donors.ref, donorRef)))
    .limit(1);
  return row?.job ?? null;
}
