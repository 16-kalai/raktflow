import { addDays, dateRange, isWithin, type ISODate } from "./dates";
import {
  BLOOD_GROUPS,
  type BloodGroup,
  type DonationCamp,
  type ExpectedYield,
  type FestivalWindow,
  type PerGroup,
  type PlannedBooking,
  type ScheduledTransfusion,
  type StockLot,
} from "./types";
import { bookingsNeeded, unitsPerBooking } from "./yield";

/**
 * Stock forecast, one blood group at a time, one day at a time:
 *
 *   tomorrow = today + collected − used − expired
 *
 * Red cells are used oldest-first (FIFO), so a unit only expires if it is
 * still on the shelf on its expiry date. Nothing here is a black box: every
 * input is a number the coordinator can see and Flagsmith can change.
 */
export interface ForecastInput {
  asOf: ISODate;
  horizonDays: number;
  lots: StockLot[];
  /** Normal daily usage per group (from the bank's own history). */
  usagePerDay: PerGroup<number>;
  /** Normal walk-in donations per day, all groups together. */
  walkInPerDay: number;
  /** Share of donors in each group (sums to ~1). */
  groupMix: PerGroup<number>;
  camps: DonationCamp[];
  /** Festival windows that apply to this bank's state. */
  festivals: FestivalWindow[];
  /** Safe stock = this many days of normal usage. */
  safeStockDays: number;
  /** Red cells in SAGM last 42 days. */
  shelfLifeDays: number;
  yield: ExpectedYield;
  bookings?: PlannedBooking[];
  transfusions?: ScheduledTransfusion[];
  /** Report days after this date only (the simulation still starts at `asOf`). */
  reportFrom?: ISODate;
}

export interface ForecastDay {
  date: ISODate;
  /** End-of-day stock if nothing changes. */
  stock: number;
  /** End-of-day stock including expected units from bookings. */
  withBookings: number;
  safeLevel: number;
  collected: number;
  used: number;
  expired: number;
  /** Demand we could not meet that day (stock hit zero). */
  unmet: number;
  festival: string | null;
}

export type GroupStatus = "ok" | "watch" | "short";

export interface GroupForecast {
  group: BloodGroup;
  startStock: number;
  safeLevel: number;
  days: ForecastDay[];
  /** First day stock drops below the safe level if nothing changes. */
  shortageDate: ISODate | null;
  /** Same, once expected units from bookings are counted. */
  shortageDateWithBookings: ISODate | null;
  /** Extra units needed so stock never drops below safe in the horizon. */
  gapUnits: number;
  bookingsNeeded: number;
  bookedCount: number;
  expectedFromBookings: number;
  /** Gap left after counting expected units from bookings. */
  remainingGapUnits: number;
  expiringUnits: number;
  status: GroupStatus;
}

export type ForecastReasonKind = "camp_cancelled" | "festival" | "expiry" | "transfusion";

export interface ForecastReason {
  kind: ForecastReasonKind;
  text: string;
  date?: ISODate;
  group?: BloodGroup;
}

export interface Forecast {
  asOf: ISODate;
  horizonDays: number;
  groups: PerGroup<GroupForecast>;
  reasons: ForecastReason[];
}

interface Lot {
  units: number;
  expiresOn: ISODate;
}

interface SimulationResult {
  days: Omit<ForecastDay, "withBookings">[];
  expiredTotal: number;
}

function activeFestival(festivals: FestivalWindow[], date: ISODate): FestivalWindow | null {
  // If two windows overlap, the harsher collection factor wins.
  let found: FestivalWindow | null = null;
  for (const f of festivals) {
    if (isWithin(date, f.start, f.end) && (!found || f.collectionFactor < found.collectionFactor)) found = f;
  }
  return found;
}

function simulateGroup(
  input: ForecastInput,
  group: BloodGroup,
  extraUnitsByDate: Map<ISODate, number>,
): SimulationResult {
  const lots: Lot[] = input.lots
    .filter((l) => l.group === group && l.units > 0)
    .map((l) => ({ units: l.units, expiresOn: l.expiresOn }))
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));

  const mix = input.groupMix[group] ?? 0;
  const baseUsage = input.usagePerDay[group] ?? 0;
  const safeLevel = baseUsage * input.safeStockDays;
  const days: Omit<ForecastDay, "withBookings">[] = [];
  let expiredTotal = 0;
  let cumulativeUnmet = 0;

  for (const date of dateRange(addDays(input.asOf, 1), input.horizonDays)) {
    const festival = activeFestival(input.festivals, date);
    const collectionFactor = festival?.collectionFactor ?? 1;
    const demandFactor = festival?.demandFactor ?? 1;

    const campUnits = input.camps
      .filter((c) => c.status === "planned" && c.date === date)
      .reduce((sum, c) => sum + c.expectedUnits, 0);
    const collected =
      (input.walkInPerDay * collectionFactor + campUnits) * mix + (extraUnitsByDate.get(date) ?? 0);
    if (collected > 0) {
      lots.push({ units: collected, expiresOn: addDays(date, input.shelfLifeDays) });
      lots.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
    }

    // Use oldest units first.
    let demand = baseUsage * demandFactor;
    const demandToday = demand;
    for (const lot of lots) {
      if (demand <= 0) break;
      const take = Math.min(lot.units, demand);
      lot.units -= take;
      demand -= take;
    }
    const unmet = demand;
    cumulativeUnmet += unmet;

    // Anything still on the shelf at expiry is discarded.
    let expired = 0;
    for (const lot of lots) {
      if (lot.expiresOn <= date && lot.units > 0) {
        expired += lot.units;
        lot.units = 0;
      }
    }
    expiredTotal += expired;
    for (let i = lots.length - 1; i >= 0; i--) if ((lots[i]?.units ?? 0) <= 1e-9) lots.splice(i, 1);

    const onShelf = lots.reduce((sum, l) => sum + l.units, 0);
    days.push({
      date,
      // Net position: shelf stock minus demand we already failed to meet.
      stock: onShelf - cumulativeUnmet,
      safeLevel,
      collected,
      used: demandToday - unmet,
      expired,
      unmet,
      festival: festival?.name ?? null,
    });
  }
  return { days, expiredTotal };
}

export function forecastGroup(input: ForecastInput, group: BloodGroup): GroupForecast {
  const perBooking = unitsPerBooking(input.yield);
  const extra = new Map<ISODate, number>();
  let bookedCount = 0;
  for (const b of input.bookings ?? []) {
    if (b.group !== group) continue;
    bookedCount += b.count;
    extra.set(b.date, (extra.get(b.date) ?? 0) + b.count * perBooking);
  }

  const base = simulateGroup(input, group, new Map());
  const withBookings = bookedCount > 0 ? simulateGroup(input, group, extra) : base;

  const allDays: ForecastDay[] = base.days.map((d, i) => ({
    ...d,
    withBookings: withBookings.days[i]?.stock ?? d.stock,
  }));
  // When the clock is past the stock snapshot, simulate from the snapshot but
  // report only from "today" onwards.
  const reportFrom = input.reportFrom;
  const days = reportFrom ? allDays.filter((d) => d.date > reportFrom) : allDays;
  const stockAtReportStart = reportFrom ? allDays.filter((d) => d.date <= reportFrom).at(-1)?.stock : undefined;

  const safeLevel = (input.usagePerDay[group] ?? 0) * input.safeStockDays;
  const shortageDate = days.find((d) => d.stock < d.safeLevel)?.date ?? null;
  const shortageDateWithBookings = days.find((d) => d.withBookings < d.safeLevel)?.date ?? null;

  const worst = (key: "stock" | "withBookings") =>
    days.reduce((max, d) => Math.max(max, d.safeLevel - d[key]), 0);
  const gapUnits = Math.ceil(worst("stock") - 1e-9);
  const remainingGapUnits = Math.max(0, Math.ceil(worst("withBookings") - 1e-9));

  const startStock =
    stockAtReportStart ?? input.lots.filter((l) => l.group === group).reduce((s, l) => s + l.units, 0);
  const minStock = days.reduce((m, d) => Math.min(m, d.stock), Number.POSITIVE_INFINITY);
  const status: GroupStatus = shortageDate ? "short" : minStock < safeLevel * 1.5 ? "watch" : "ok";

  return {
    group,
    startStock,
    safeLevel,
    days,
    shortageDate,
    shortageDateWithBookings,
    gapUnits,
    bookingsNeeded: bookingsNeeded(gapUnits, input.yield),
    bookedCount,
    expectedFromBookings: bookedCount * perBooking,
    remainingGapUnits,
    expiringUnits: base.expiredTotal,
    status,
  };
}

export function forecast(input: ForecastInput): Forecast {
  const groups = Object.fromEntries(BLOOD_GROUPS.map((g) => [g, forecastGroup(input, g)])) as PerGroup<GroupForecast>;
  return { asOf: input.asOf, horizonDays: input.horizonDays, groups, reasons: explain(input, groups) };
}

/** The "why" box: plain-language causes, each traceable to an input. */
function explain(input: ForecastInput, groups: PerGroup<GroupForecast>): ForecastReason[] {
  const end = addDays(input.asOf, input.horizonDays);
  const from = input.reportFrom && input.reportFrom > input.asOf ? input.reportFrom : input.asOf;
  const reasons: ForecastReason[] = [];

  const cancelled = input.camps.filter((c) => c.status === "cancelled" && isWithin(c.date, from, end));
  if (cancelled.length > 0) {
    const units = cancelled.reduce((s, c) => s + c.expectedUnits, 0);
    reasons.push({
      kind: "camp_cancelled",
      text: `${cancelled.length} donation camp${cancelled.length > 1 ? "s" : ""} cancelled (−${units} units): ${cancelled
        .map((c) => c.cancelReason ?? c.name)
        .join(", ")}`,
    });
  }

  for (const f of input.festivals) {
    if (f.end < from || f.start > end) continue;
    reasons.push({
      kind: "festival",
      text: `${f.name}: walk-in donations at ${Math.round(f.collectionFactor * 100)}% of normal (${f.start} → ${f.end})`,
      date: f.start,
    });
  }

  for (const g of BLOOD_GROUPS) {
    const gf = groups[g];
    if (gf.status === "short" && gf.expiringUnits >= 1) {
      reasons.push({
        kind: "expiry",
        group: g,
        text: `${Math.round(gf.expiringUnits)} ${g} units expire on the shelf in the next ${input.horizonDays} days`,
      });
    }
  }

  for (const t of input.transfusions ?? []) {
    if (isWithin(t.date, from, end)) {
      reasons.push({ kind: "transfusion", group: t.group, date: t.date, text: `${t.label}: ${t.units} ${t.group} units on ${t.date}` });
    }
  }
  return reasons;
}
