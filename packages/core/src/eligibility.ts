import { addDays, type ISODate } from "./dates";
import type { BloodGroup } from "./types";

/** Minimum gap between whole-blood donations (NBTC guidance). */
export const MIN_DAYS_BETWEEN_DONATIONS = { male: 90, female: 120 } as const;

export interface DonorForEligibility {
  bloodGroup: BloodGroup;
  sex: "male" | "female";
  lastDonationOn: ISODate | null;
  consentAt: Date | null;
  optedOutAt: Date | null;
  deferredUntil: ISODate | null;
  dndCheckedAt: Date | null;
}

export type IneligibleReason =
  | "wrong_group"
  | "no_consent"
  | "opted_out"
  | "deferred"
  | "too_soon"
  | "dnd_unchecked";

export interface EligibilityResult {
  eligible: boolean;
  reasons: IneligibleReason[];
  eligibleFrom: ISODate | null;
}

/**
 * Can we ask this donor to give blood on `donationDate`?
 * The call is only a pre-check; the doctor decides at the centre.
 */
export function checkEligibility(
  donor: DonorForEligibility,
  group: BloodGroup,
  donationDate: ISODate,
): EligibilityResult {
  const reasons: IneligibleReason[] = [];
  if (donor.bloodGroup !== group) reasons.push("wrong_group");
  if (!donor.consentAt) reasons.push("no_consent");
  if (donor.optedOutAt) reasons.push("opted_out");
  if (!donor.dndCheckedAt) reasons.push("dnd_unchecked");
  if (donor.deferredUntil && donor.deferredUntil > donationDate) reasons.push("deferred");

  let eligibleFrom: ISODate | null = null;
  if (donor.lastDonationOn) {
    eligibleFrom = addDays(donor.lastDonationOn, MIN_DAYS_BETWEEN_DONATIONS[donor.sex]);
    if (eligibleFrom > donationDate) reasons.push("too_soon");
  }
  return { eligible: reasons.length === 0, reasons, eligibleFrom };
}

/** TRAI-friendly calling window, in India time. */
export function isWithinCallingHours(now: Date, startHour = 9, endHour = 21): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(now),
  );
  return hour >= startHour && hour < endHour;
}
