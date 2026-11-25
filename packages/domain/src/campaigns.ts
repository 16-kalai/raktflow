import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { checkEligibility, type BloodGroup } from "@raktflow/core";
import { bookings, callJobs, campaigns, donors, type Database } from "@raktflow/db";
import { FlagsmithAdmin, FLAG, adminConfigFromEnv, refreshFlags, type BankFlags } from "@raktflow/flags";
import { getOpenSlots, bookSlot } from "./bookings";
import { campaignWindow, loadBankForecast, type BankForecast } from "./forecast";
import { logEvent } from "./events";

type Bank = Parameters<typeof loadBankForecast>[1] & { slug: string; name: string; city: string };
export type Campaign = typeof campaigns.$inferSelect;

export async function currentCampaign(db: Database, bankId: string): Promise<Campaign | null> {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.bankId, bankId), inArray(campaigns.status, ["pending_approval", "active", "completed"])))
    .orderBy(sql`${campaigns.createdAt} desc`)
    .limit(1);
  return row ?? null;
}

/**
 * Turns a forecast shortage into a campaign waiting for the medical officer,
 * and hands it to NudgeBee. Nothing is dialled until surge_mode is ON.
 */
export async function raiseShortage(
  db: Database,
  bank: Bank,
  group: BloodGroup,
  fc: BankForecast,
  actor: string,
): Promise<{ campaign: Campaign; nudgebee: "sent" | "not_configured" | "failed" }> {
  const g = fc.result.groups[group];
  if (!g.shortageDate || g.gapUnits <= 0) throw new Error(`${group} has no projected shortage`);

  const [open] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.bankId, bank.id), eq(campaigns.bloodGroup, group), inArray(campaigns.status, ["pending_approval", "active"])))
    .limit(1);
  if (open) return { campaign: open, nudgebee: "sent" };

  const window = campaignWindow(fc.today, g.shortageDate);
  const [campaign] = await db
    .insert(campaigns)
    .values({
      bankId: bank.id,
      bloodGroup: group,
      shortageDate: g.shortageDate,
      gapUnits: g.gapUnits,
      bookingsTarget: g.bookingsNeeded,
      windowStart: window.start,
      windowEnd: window.end,
      status: "pending_approval",
    })
    .returning();
  if (!campaign) throw new Error("campaign insert failed");

  await logEvent(db, bank.id, "forecast", actor, `${group} projected below safe on ${g.shortageDate}: short by ${g.gapUnits} units (${g.bookingsNeeded} bookings)`, {
    campaignId: campaign.id,
  });

  const url = process.env.NUDGEBEE_SHORTAGE_WEBHOOK_URL;
  if (!url) {
    await logEvent(db, bank.id, "nudgebee", "raktflow", "Waiting for medical officer approval (NudgeBee webhook not configured)");
    return { campaign, nudgebee: "not_configured" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        type: "blood_shortage_forecast",
        campaign_id: campaign.id,
        bank: { slug: bank.slug, name: bank.name, city: bank.city, state: bank.state },
        blood_group: group,
        shortage_date: g.shortageDate,
        gap_units: g.gapUnits,
        bookings_needed: g.bookingsNeeded,
        call_window: window,
        reasons: fc.result.reasons.map((r) => r.text),
        plan: `Call eligible, consenting ${group} donors (9am–9pm, DND checked). Ask them to donate before they travel, ${window.start} to ${window.end}. Stop when expected units cover ${g.gapUnits}.`,
        on_approve: { flag: FLAG.surgeMode, value: true },
        dashboard_url: `${process.env.APP_URL ?? ""}/dashboard`,
      }),
    });
    if (!res.ok) throw new Error(`NudgeBee ${res.status}`);
    await logEvent(db, bank.id, "nudgebee", "raktflow", `Shortage sent to NudgeBee for medical officer approval`, { campaignId: campaign.id });
    return { campaign, nudgebee: "sent" };
  } catch (err) {
    await logEvent(db, bank.id, "nudgebee", "raktflow", `Could not reach NudgeBee: ${(err as Error).message}`);
    return { campaign, nudgebee: "failed" };
  }
}

/**
 * Reconciler: makes the database match Flagsmith. NudgeBee only writes the
 * desired state (surge_mode); this function does the rest, so there is never
 * a half-finished two-step write. Safe to run often, from any pod.
 */
export async function reconcile(db: Database, bank: Bank, flags: BankFlags): Promise<void> {
  const campaign = await currentCampaign(db, bank.id);
  if (!campaign) return;

  if (campaign.status === "pending_approval" && flags.surgeMode) {
    const [activated] = await db
      .update(campaigns)
      .set({ status: "active", approvedAt: new Date(), approvedBy: campaign.approvedBy ?? "medical officer (via NudgeBee)" })
      .where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, "pending_approval")))
      .returning();
    if (activated) {
      // Only a medical officer's approval in NudgeBee may ring the real demo phone.
      // Approvals made inside RaktFlow (anyone viewing the public demo) use test donors only.
      const realCalls = (activated.approvedBy ?? "").includes("NudgeBee");
      const queued = await enqueueDonors(db, bank.id, activated, realCalls);
      await logEvent(db, bank.id, "campaign", "raktflow", `Surge mode ON in Flagsmith → campaign active, ${queued} eligible ${activated.bloodGroup} donors queued`);
    }
    return;
  }

  if (campaign.status === "active") {
    const fc = await loadBankForecast(db, bank, flags);
    const g = fc.result.groups[campaign.bloodGroup as BloodGroup];
    if (g && g.remainingGapUnits <= 0) await completeCampaign(db, bank.id, campaign, g.expectedFromBookings, g.bookedCount);
  }
}

async function enqueueDonors(db: Database, bankId: string, campaign: Campaign, realCalls: boolean): Promise<number> {
  const pool = await db
    .select()
    .from(donors)
    .where(and(eq(donors.bankId, bankId), eq(donors.bloodGroup, campaign.bloodGroup), isNull(donors.optedOutAt)));
  const eligible = pool.filter(
    (d) =>
      checkEligibility(
        {
          bloodGroup: d.bloodGroup as BloodGroup,
          sex: d.sex,
          lastDonationOn: d.lastDonationOn,
          consentAt: d.consentAt,
          optedOutAt: d.optedOutAt,
          deferredUntil: d.deferredUntil,
          dndCheckedAt: d.dndCheckedAt,
        },
        campaign.bloodGroup as BloodGroup,
        campaign.windowStart,
      ).eligible,
  );
  if (eligible.length === 0) return 0;
  // Batch inserts so a bank with 100k donors doesn't build one giant statement.
  for (let i = 0; i < eligible.length; i += 500) {
    await db
      .insert(callJobs)
      .values(
        eligible.slice(i, i + 500).map((d) => ({
          bankId,
          campaignId: campaign.id,
          donorId: d.id,
          priority: d.isDemoContact ? 1 : 100,
          simulated: !(d.isDemoContact && realCalls),
          // Synthetic donors wait for the "simulate" button; only real contacts are dialled now.
          nextAttemptAt: d.isDemoContact && realCalls ? new Date() : new Date("2999-01-01T00:00:00Z"),
        })),
      )
      .onConflictDoNothing();
  }
  return eligible.length;
}

async function completeCampaign(db: Database, bankId: string, campaign: Campaign, expected: number, booked: number) {
  const [done] = await db
    .update(campaigns)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, "active")))
    .returning();
  if (!done) return;
  await db
    .update(callJobs)
    .set({ status: "skipped" })
    .where(and(eq(callJobs.campaignId, campaign.id), eq(callJobs.status, "queued")));
  await logEvent(db, bankId, "campaign", "raktflow", `Gap covered: ${booked} bookings → ${expected.toFixed(1)} expected units. Calling stopped.`);

  const cfg = adminConfigFromEnv();
  if (cfg) {
    try {
      await new FlagsmithAdmin(cfg).setFlag(FLAG.surgeMode, { enabled: false });
      await refreshFlags();
      await logEvent(db, bankId, "flag", "raktflow", "surge_mode → OFF in Flagsmith");
    } catch (err) {
      await logEvent(db, bankId, "flag", "raktflow", `Could not switch surge_mode off: ${(err as Error).message}`);
    }
  }
}

/**
 * Demo helper ("sped up — test donors"): books the next `count` synthetic
 * donors from the queue into open slots, as if their calls said yes.
 */
export async function simulateBookings(db: Database, bankId: string, campaign: Campaign, count: number): Promise<number> {
  const jobs = await db
    .select({ jobId: callJobs.id, ref: donors.ref })
    .from(callJobs)
    .innerJoin(donors, eq(donors.id, callJobs.donorId))
    .where(
      and(
        eq(callJobs.campaignId, campaign.id),
        eq(callJobs.simulated, true),
        eq(callJobs.status, "queued"),
        notInArray(callJobs.donorId, db.select({ id: bookings.donorId }).from(bookings).where(eq(bookings.campaignId, campaign.id))),
      ),
    )
    .orderBy(asc(callJobs.priority), asc(callJobs.createdAt))
    .limit(count);
  const open = await getOpenSlots(db, bankId, campaign.windowStart, campaign.windowEnd);
  let made = 0;
  for (const job of jobs) {
    const slot = open.find((s) => s.remaining > 0);
    if (!slot) break;
    await bookSlot(db, {
      bankId,
      donorRef: job.ref,
      slotId: slot.id,
      campaignId: campaign.id,
      idempotencyKey: `sim:${campaign.id}:${job.ref}`,
      simulated: true,
      actor: "test donor (simulated)",
    });
    slot.remaining -= 1;
    await db.update(callJobs).set({ status: "completed", outcome: "booked" }).where(eq(callJobs.id, job.jobId));
    made += 1;
  }
  return made;
}
