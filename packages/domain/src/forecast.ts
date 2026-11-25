import { and, eq, gte, inArray, sql } from "drizzle-orm";
import {
  addDays,
  diffDays,
  forecast,
  isBloodGroup,
  todayInIndia,
  type BloodGroup,
  type FestivalWindow,
  type Forecast,
  type ForecastInput,
  type ISODate,
  type PerGroup,
  type PlannedBooking,
} from "@raktflow/core";
import { bookings, camps, festivalWindows, slots, stockLots, transfusions, type Database } from "@raktflow/db";
import type { BankFlags } from "@raktflow/flags";

type Bank = {
  id: string;
  state: string;
  demoDate: string | null;
  stockAsOf: string;
  usagePerDay: Record<string, number>;
  groupMix: Record<string, number>;
  walkInPerDay: number;
};

export function bankToday(bank: Pick<Bank, "demoDate">): ISODate {
  return bank.demoDate ?? todayInIndia();
}

export interface BankForecast {
  today: ISODate;
  festivals: FestivalWindow[];
  input: ForecastInput;
  result: Forecast;
}

/**
 * Builds the forecast from the bank's own data plus Flagsmith settings.
 * Festival effects apply only while Flagsmith says the bank is in festive
 * mode (a segment on state + date), so the switch is visible and reversible.
 */
export async function loadBankForecast(db: Database, bank: Bank, flags: BankFlags): Promise<BankForecast> {
  const today = bankToday(bank);
  const cfg = flags.forecastConfig;
  const snapshot = bank.stockAsOf;
  const horizon = Math.max(0, diffDays(snapshot, today)) + cfg.horizonDays;

  const [lots, campRows, festivalRows, transfusionRows, bookingRows] = await Promise.all([
    db.select().from(stockLots).where(and(eq(stockLots.bankId, bank.id), gte(stockLots.expiresOn, snapshot))),
    db.select().from(camps).where(eq(camps.bankId, bank.id)),
    db.select().from(festivalWindows).where(eq(festivalWindows.state, bank.state)),
    db.select().from(transfusions).where(eq(transfusions.bankId, bank.id)),
    db
      .select({
        group: bookings.bloodGroup,
        date: sql<string>`to_char(${slots.startsAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .innerJoin(slots, eq(slots.id, bookings.slotId))
      .where(and(eq(bookings.bankId, bank.id), inArray(bookings.status, ["booked", "collected"])))
      .groupBy(bookings.bloodGroup, sql`2`),
  ]);

  const festivals: FestivalWindow[] = flags.festiveMode
    ? festivalRows.map((f) => ({
        name: f.name,
        start: f.start,
        end: f.end,
        collectionFactor: cfg.festivalFactors[f.name] ?? f.collectionFactor,
        demandFactor: f.demandFactor,
      }))
    : [];

  const input: ForecastInput = {
    asOf: snapshot,
    reportFrom: today > snapshot ? today : undefined,
    horizonDays: horizon,
    lots: lots.filter((l) => isBloodGroup(l.bloodGroup)).map((l) => ({ group: l.bloodGroup as BloodGroup, units: l.units, expiresOn: l.expiresOn })),
    usagePerDay: bank.usagePerDay as PerGroup<number>,
    walkInPerDay: bank.walkInPerDay,
    groupMix: bank.groupMix as PerGroup<number>,
    camps: campRows.map((c) => ({ name: c.name, date: c.date, expectedUnits: c.expectedUnits, status: c.status, cancelReason: c.cancelReason ?? undefined })),
    festivals,
    safeStockDays: cfg.safeStockDays,
    shelfLifeDays: cfg.shelfLifeDays,
    yield: cfg.yield,
    bookings: bookingRows.filter((b) => isBloodGroup(b.group)).map((b): PlannedBooking => ({ group: b.group as BloodGroup, date: b.date, count: b.count })),
    transfusions: transfusionRows
      .filter((t) => isBloodGroup(t.bloodGroup))
      .map((t) => ({ label: t.label, group: t.bloodGroup as BloodGroup, date: t.date, units: t.units })),
  };
  return { today, festivals, input, result: forecast(input) };
}

/** The week before a shortage: when "donate before you travel" works. */
export function campaignWindow(today: ISODate, shortageDate: ISODate): { start: ISODate; end: ISODate } {
  const end = addDays(shortageDate, -4);
  const start = addDays(shortageDate, -10);
  return { start: start > today ? start : addDays(today, 1), end: end > today ? end : addDays(today, 2) };
}
