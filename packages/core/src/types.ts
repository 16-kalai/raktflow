import type { ISODate } from "./dates";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export function isBloodGroup(value: string): value is BloodGroup {
  return (BLOOD_GROUPS as readonly string[]).includes(value);
}

export type PerGroup<T> = Record<BloodGroup, T>;

/** A batch of red-cell units that expire on the same day. */
export interface StockLot {
  group: BloodGroup;
  units: number;
  expiresOn: ISODate;
}

export interface DonationCamp {
  name: string;
  date: ISODate;
  expectedUnits: number;
  status: "planned" | "cancelled";
  cancelReason?: string;
}

/** A festival window during which donations (and sometimes demand) change. */
export interface FestivalWindow {
  name: string;
  start: ISODate;
  end: ISODate;
  /** 0.4 means walk-in donations fall to 40% of normal. */
  collectionFactor: number;
  /** 1 means hospital demand is unchanged. */
  demandFactor: number;
}

export interface ExpectedYield {
  /** Share of booked donors who turn up. */
  showUp: number;
  /** Share of donors who turn up and pass screening (Hb, BP, history). */
  passScreening: number;
}

export interface PlannedBooking {
  group: BloodGroup;
  date: ISODate;
  count: number;
}

export interface ScheduledTransfusion {
  label: string;
  group: BloodGroup;
  date: ISODate;
  units: number;
}
