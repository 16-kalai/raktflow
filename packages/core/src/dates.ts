/**
 * Calendar dates as ISO strings ("2026-11-08"). Forecasts work in whole days,
 * so we avoid Date objects and their time-zone surprises everywhere in core.
 */
export type ISODate = string;

const DAY_MS = 86_400_000;

function toUTC(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid ISO date: ${date}`);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** 2026-10-20 → 20261020. Flagsmith segment rules compare numbers, not dates. */
export function toDateNumber(date: ISODate): number {
  return Number(date.replaceAll("-", ""));
}

export function isWithin(date: ISODate, start: ISODate, end: ISODate): boolean {
  return date >= start && date <= end;
}

export function dateRange(start: ISODate, days: number): ISODate[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

/** Today's date in India, used when no demo clock is set. */
export function todayInIndia(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}
