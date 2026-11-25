import "server-only";
import { desc, eq, isNull, or, sql } from "drizzle-orm";
import { BLOOD_GROUPS, type BloodGroup } from "@raktflow/core";
import { callJobs, donors, events, getDb, type banks } from "@raktflow/db";
import { activeCallCount, bankToday, currentCampaign, loadBankForecast, reconcile } from "@raktflow/domain";
import { getBankFlags } from "@raktflow/flags";

type Bank = typeof banks.$inferSelect;

export async function bankFlags(bank: Bank, today: string) {
  return getBankFlags({ slug: bank.slug, state: bank.state, date: today });
}

/** Everything the dashboard shows, in one round trip. */
export async function buildOverview(bank: Bank) {
  const db = getDb();
  const today = bankToday(bank);
  let flags = await bankFlags(bank, today);
  await reconcile(db, bank, flags);
  flags = await bankFlags(bank, today);

  const [fc, campaign, recentEvents, activeCalls] = await Promise.all([
    loadBankForecast(db, bank, flags),
    currentCampaign(db, bank.id),
    db.select().from(events).where(or(eq(events.bankId, bank.id), isNull(events.bankId))).orderBy(desc(events.createdAt)).limit(25),
    activeCallCount(db),
  ]);

  const short = BLOOD_GROUPS.filter((g) => fc.result.groups[g].status === "short");
  const focus: BloodGroup = (campaign?.bloodGroup as BloodGroup | undefined) ?? short[0] ?? "O+";
  const fg = fc.result.groups[focus];

  const calls = campaign
    ? await db
        .select({
          id: callJobs.id,
          status: callJobs.status,
          outcome: callJobs.outcome,
          simulated: callJobs.simulated,
          durationSec: callJobs.durationSec,
          transcript: callJobs.transcript,
          healthAnswers: callJobs.healthAnswers,
          updatedAt: callJobs.updatedAt,
          donorRef: donors.ref,
          donorName: donors.name,
          language: donors.language,
          lastDonationOn: donors.lastDonationOn,
        })
        .from(callJobs)
        .innerJoin(donors, eq(donors.id, callJobs.donorId))
        .where(sql`${callJobs.campaignId} = ${campaign.id} and (${callJobs.simulated} = false or ${callJobs.status} <> 'queued')`)
        .orderBy(callJobs.priority, desc(callJobs.updatedAt))
        .limit(12)
    : [];

  const queued = campaign
    ? (
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(callJobs)
          .where(sql`${callJobs.campaignId} = ${campaign.id} and ${callJobs.status} = 'queued'`)
      )[0]?.n ?? 0
    : 0;

  return {
    bank: { name: bank.name, city: bank.city, state: bank.state, isDemo: bank.isDemo, stockAsOf: bank.stockAsOf },
    today: fc.today,
    flags,
    groups: BLOOD_GROUPS.map((g) => {
      const x = fc.result.groups[g];
      return {
        group: g,
        status: x.status,
        startStock: x.startStock,
        safeLevel: x.safeLevel,
        shortageDate: x.shortageDate,
        gapUnits: x.gapUnits,
      };
    }),
    focus: {
      group: focus,
      status: fg.status,
      startStock: fg.startStock,
      safeLevel: fg.safeLevel,
      shortageDate: fg.shortageDate,
      shortageDateWithBookings: fg.shortageDateWithBookings,
      gapUnits: fg.gapUnits,
      bookingsNeeded: fg.bookingsNeeded,
      bookedCount: fg.bookedCount,
      expectedFromBookings: fg.expectedFromBookings,
      remainingGapUnits: fg.remainingGapUnits,
      days: fg.days.map((d) => ({
        date: d.date,
        stock: Math.round(d.stock * 10) / 10,
        withBookings: Math.round(d.withBookings * 10) / 10,
        safeLevel: d.safeLevel,
        festival: d.festival,
      })),
    },
    reasons: fc.result.reasons.map((r) => r.text),
    festivals: fc.festivals,
    transfusions: (fc.input.transfusions ?? []).filter((t) => t.group === focus),
    yield: flags.forecastConfig.yield,
    campaign,
    queued,
    calls,
    activeCalls,
    events: recentEvents,
  };
}

export type Overview = Awaited<ReturnType<typeof buildOverview>>;
