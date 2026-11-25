import { config } from "dotenv";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { eq } from "drizzle-orm";
import pino from "pino";
import { isWithinCallingHours } from "@raktflow/core";
import { banks, callJobs, campaigns, closeDb, donors, getDb } from "@raktflow/db";
import {
  acquireCallPermit,
  bankToday,
  bookSlot,
  claimNextJob,
  getOpenSlots,
  logEvent,
  markDialled,
  releaseCallPermit,
  requeueJob,
  type CallJob,
} from "@raktflow/domain";
import { getBankFlags, getDonorFlags } from "@raktflow/flags";
import { SarvamRateLimitError, SarvamVoice, sarvamConfigFromEnv } from "@raktflow/sarvam";
import { ProviderLimiter, RateLimitWatch } from "./limits";

config({ path: new URL("../../../.env.local", import.meta.url).pathname });

/**
 * Voice worker. Run as many replicas as you like: jobs are claimed with leases,
 * and the number of calls in progress is capped globally (Postgres permits) by
 * the value of `max_concurrent_calls` in Flagsmith.
 */
const log = pino({ base: { svc: "voice-worker", pod: process.env.POD_NAME ?? hostname() } });
const workerId = `${process.env.POD_NAME ?? hostname()}:${process.pid}`;
const db = getDb({ max: Number(process.env.DB_POOL_MAX ?? 4) });
const sarvamCfg = sarvamConfigFromEnv();
const sarvam = sarvamCfg ? new SarvamVoice(sarvamCfg) : null;
const LEASE_SECONDS = 300;
const POLL_MS = Number(process.env.POLL_MS ?? 1500);
const SLOTS = Number(process.env.WORKER_SLOTS ?? 4);

/**
 * Synthetic donors are never dialled. In load-test mode their calls go to a
 * mock provider that allows only PROVIDER_LIMIT calls at once and answers 429
 * above that, the way Sarvam's pay-as-you-go tier does. (Fault injection for
 * the demo; captioned as such.)
 */
const mockProvider = new ProviderLimiter(Number(process.env.MOCK_PROVIDER_LIMIT ?? 3));
const rateWatch = new RateLimitWatch(log);

/** "2026-11-05" → "5 November", the way the agent should say it. */
function spokenDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

let running = true;
let inFlight = 0;

async function handle(job: CallJob): Promise<void> {
  const [row] = await db
    .select({ donor: donors, bank: banks, campaign: campaigns })
    .from(donors)
    .innerJoin(banks, eq(banks.id, donors.bankId))
    .innerJoin(campaigns, eq(campaigns.id, job.campaignId))
    .where(eq(donors.id, job.donorId));
  if (!row) return requeueJob(db, job.id, 3600, "donor or campaign missing");
  const { donor, bank, campaign } = row;

  if (campaign.status !== "active") {
    await db.update(callJobs).set({ status: "skipped" }).where(eq(callJobs.id, job.id));
    return;
  }

  const flags = await getBankFlags({ slug: bank.slug, state: bank.state, date: bankToday(bank) });
  if (!flags.outboundCallsEnabled || !flags.surgeMode) {
    log.info({ job: job.id, outbound: flags.outboundCallsEnabled, surge: flags.surgeMode }, "calls paused by Flagsmith");
    return requeueJob(db, job.id, 30, "paused by flag");
  }
  if (!isWithinCallingHours(new Date())) return requeueJob(db, job.id, 1800, "outside 9am–9pm");

  if (!(await acquireCallPermit(db, job.id, workerId, flags.maxConcurrentCalls, LEASE_SECONDS))) {
    return requeueJob(db, job.id, 2, "global call limit reached");
  }

  try {
    if (job.simulated) {
      await mockCall(job, donor.ref, bank.id, campaign);
      return;
    }
    if (!sarvam) throw new Error("Sarvam is not configured");
    const donorFlags = await getDonorFlags({ ref: donor.ref, language: donor.language, donorType: donor.donorType, state: bank.state });
    const appUrl = process.env.APP_URL ?? "";
    const { attemptId } = await sarvam.startOutboundCall({
      phone: donor.phone,
      language: donorFlags.language,
      variables: {
        donor_ref: donor.ref,
        donor_name: donor.name,
        bank_name: bank.name,
        centre_name: bank.name,
        festive_start: spokenDate(campaign.windowStart),
        festive_end: spokenDate(campaign.windowEnd),
        blood_group: donor.bloodGroup,
        shortage_after: "Diwali",
        drive_start: campaign.windowStart,
        drive_end: campaign.windowEnd,
        call_script: donorFlags.callScript,
        health_questions: flags.healthQuestions.questions.map((q, i) => `${i + 1}. ${q.question}`).join(" "),
        health_questions_version: flags.healthQuestions.version,
      },
      webhookUrl: `${appUrl}/api/webhooks/sarvam?key=${encodeURIComponent(process.env.RAKTFLOW_API_KEY ?? "")}`,
      webhookMetadata: { job_id: job.id, campaign_id: campaign.id },
    });
    await markDialled(db, job.id, attemptId);
    await logEvent(db, bank.id, "call", "sarvam", `Calling ${donor.name} (${donor.ref}) in ${donorFlags.language}, script "${donorFlags.callScript}"`);
    log.info({ job: job.id, attemptId, concurrency: flags.maxConcurrentCalls }, "sarvam call started");
    // The permit is released by the post-call webhook (or expires with the lease).
  } catch (err) {
    await releaseCallPermit(db, job.id);
    if (err instanceof SarvamRateLimitError) {
      rateWatch.record(flags.maxConcurrentCalls, bank.id);
      log.warn({ job: job.id, concurrency: flags.maxConcurrentCalls, status: 429 }, "sarvam 429 · rate limited by voice provider");
      return requeueJob(db, job.id, 5 + Math.floor(Math.random() * 5), "provider 429");
    }
    log.error({ job: job.id, err: (err as Error).message }, "call failed");
    await requeueJob(db, job.id, 120, (err as Error).message);
  }
}

async function mockCall(job: CallJob, donorRef: string, bankId: string, campaign: typeof campaigns.$inferSelect) {
  if (!mockProvider.tryAcquire()) {
    throw new SarvamRateLimitError("mock provider: concurrency limit");
  }
  try {
    await new Promise((r) => setTimeout(r, 4000 + Math.random() * 4000));
    const yes = Math.random() < 0.6;
    if (yes) {
      const open = await getOpenSlots(db, bankId, campaign.windowStart, campaign.windowEnd);
      const slot = open[Math.floor(Math.random() * Math.min(open.length, 6))];
      if (slot) {
        await bookSlot(db, {
          bankId,
          donorRef,
          slotId: slot.id,
          campaignId: campaign.id,
          idempotencyKey: `mock:${job.id}`,
          simulated: true,
          actor: "test donor (load test)",
        });
      }
    }
    await db
      .update(callJobs)
      .set({ status: "completed", outcome: yes ? "booked" : "declined" })
      .where(eq(callJobs.id, job.id));
  } finally {
    mockProvider.release();
    await releaseCallPermit(db, job.id);
  }
}

async function loop(slot: number) {
  while (running) {
    try {
      const job = await claimNextJob(db, `${workerId}#${slot}`, LEASE_SECONDS);
      if (!job) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        continue;
      }
      inFlight++;
      try {
        await handle(job);
      } finally {
        inFlight--;
      }
    } catch (err) {
      log.error({ err: (err as Error).message }, "worker loop error");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// Liveness/readiness for Kubernetes.
const server = createServer((req, res) => {
  if (req.url === "/healthz") return void res.writeHead(200).end("ok");
  if (req.url === "/readyz") return void res.writeHead(running ? 200 : 503).end(running ? "ready" : "draining");
  if (req.url === "/metrics") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return void res.end(`raktflow_worker_inflight ${inFlight}\nraktflow_worker_429_total ${rateWatch.total}\n`);
  }
  res.writeHead(404).end();
});
server.listen(Number(process.env.PORT ?? 8080));

async function shutdown(signal: string) {
  log.info({ signal }, "draining");
  running = false;
  const deadline = Date.now() + 25_000;
  while (inFlight > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
  server.close();
  await closeDb();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

log.info({ workerId, slots: SLOTS, sarvam: Boolean(sarvam) }, "voice worker started");
await Promise.all(Array.from({ length: SLOTS }, (_, i) => loop(i)));
