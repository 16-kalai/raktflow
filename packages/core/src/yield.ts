import type { ExpectedYield } from "./types";

/** Units of blood we expect from one booking. A booking is not a unit. */
export function unitsPerBooking(y: ExpectedYield): number {
  return clamp01(y.showUp) * clamp01(y.passScreening);
}

export function expectedUnits(bookings: number, y: ExpectedYield): number {
  return bookings * unitsPerBooking(y);
}

/** Bookings needed so that expected units cover the gap. */
export function bookingsNeeded(gapUnits: number, y: ExpectedYield): number {
  const perBooking = unitsPerBooking(y);
  if (gapUnits <= 0) return 0;
  if (perBooking <= 0) return Number.POSITIVE_INFINITY;
  // Small epsilon so 24 / 0.6 = 40 stays 40 despite floating-point noise.
  return Math.ceil(gapUnits / perBooking - 1e-9);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
