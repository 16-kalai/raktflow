import { describe, expect, it } from "vitest";
import {
  DEMO_AS_OF,
  DEMO_CAMPS,
  DEMO_FESTIVALS_BY_STATE,
  DEMO_GROUP_MIX,
  DEMO_HORIZON_DAYS,
  DEMO_SAFE_STOCK_DAYS,
  DEMO_SHELF_LIFE_DAYS,
  DEMO_TRANSFUSIONS,
  DEMO_USAGE_PER_DAY,
  DEMO_WALK_IN_PER_DAY,
  DEMO_YIELD,
  demoStockLots,
} from "./demo";
import { forecast, forecastGroup, type ForecastInput } from "./forecast";
import { addDays } from "./dates";
import { bookingsNeeded, expectedUnits } from "./yield";
import { checkEligibility } from "./eligibility";

function demoInput(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    asOf: DEMO_AS_OF,
    horizonDays: DEMO_HORIZON_DAYS,
    lots: demoStockLots(),
    usagePerDay: DEMO_USAGE_PER_DAY,
    walkInPerDay: DEMO_WALK_IN_PER_DAY,
    groupMix: DEMO_GROUP_MIX,
    camps: DEMO_CAMPS,
    festivals: DEMO_FESTIVALS_BY_STATE.MH ?? [],
    safeStockDays: DEMO_SAFE_STOCK_DAYS,
    shelfLifeDays: DEMO_SHELF_LIFE_DAYS,
    yield: DEMO_YIELD,
    transfusions: DEMO_TRANSFUSIONS,
    ...overrides,
  };
}

describe("demo scenario (what the video shows)", () => {
  it("projects O+ falling below safe on Nov 11, before Aarav's Nov 14 transfusion", () => {
    const o = forecastGroup(demoInput(), "O+");
    expect(o.shortageDate).toBe("2026-11-11");
    expect(o.status).toBe("short");
  });

  it("sizes the O+ gap at 25 units and 41 bookings", () => {
    const o = forecastGroup(demoInput(), "O+");
    expect(o.gapUnits).toBe(25);
    expect(o.bookingsNeeded).toBe(41);
  });

  it("only O+ is short in the demo", () => {
    const f = forecast(demoInput());
    const short = Object.values(f.groups).filter((g) => g.status === "short").map((g) => g.group);
    expect(short).toEqual(["O+"]);
  });

  it("without the festival, O+ stays safe (festive mode matters)", () => {
    const o = forecastGroup(demoInput({ festivals: [] }), "O+");
    expect(o.shortageDate).toBeNull();
  });

  it("41 bookings on Nov 1–7 close the gap on expected units", () => {
    const bookings = Array.from({ length: 7 }, (_, i) => ({
      group: "O+" as const,
      date: addDays("2026-11-01", i),
      count: i < 6 ? 6 : 5,
    }));
    const o = forecastGroup(demoInput({ bookings }), "O+");
    expect(o.bookedCount).toBe(41);
    expect(o.remainingGapUnits).toBe(0);
    expect(o.shortageDateWithBookings).toBeNull();
  });

  it("explains itself: cancelled camps, the festival and Aarav", () => {
    const kinds = forecast(demoInput()).reasons.map((r) => r.kind);
    expect(kinds).toContain("camp_cancelled");
    expect(kinds).toContain("festival");
    expect(kinds).toContain("transfusion");
  });
});

describe("forecast mechanics", () => {
  it("uses oldest units first and discards what is left at expiry", () => {
    const o = forecastGroup(
      demoInput({
        lots: [
          { group: "O+", units: 5, expiresOn: addDays(DEMO_AS_OF, 2) },
          { group: "O+", units: 50, expiresOn: addDays(DEMO_AS_OF, 30) },
        ],
        usagePerDay: { ...DEMO_USAGE_PER_DAY, "O+": 1 },
        walkInPerDay: 0,
        camps: [],
        festivals: [],
      }),
      "O+",
    );
    // Day 1 uses 1 old unit, day 2 uses 1 more, the remaining 3 expire on day 2.
    expect(o.days[1]?.expired).toBe(3);
  });

  it("counts unmet demand as a deficit instead of flooring at zero", () => {
    const o = forecastGroup(
      demoInput({ lots: [], walkInPerDay: 0, camps: [], festivals: [], usagePerDay: { ...DEMO_USAGE_PER_DAY, "O+": 2 } }),
      "O+",
    );
    expect(o.days[2]?.stock).toBe(-6);
    expect(o.days[2]?.unmet).toBe(2);
  });
});

describe("expected yield", () => {
  it("a booking is not a unit", () => {
    expect(expectedUnits(39, DEMO_YIELD)).toBeCloseTo(24.3, 1);
    expect(bookingsNeeded(24, DEMO_YIELD)).toBe(39);
    expect(bookingsNeeded(0, DEMO_YIELD)).toBe(0);
  });
});

describe("eligibility", () => {
  const base = {
    bloodGroup: "O+" as const,
    sex: "male" as const,
    lastDonationOn: "2026-06-30",
    consentAt: new Date(),
    optedOutAt: null,
    deferredUntil: null,
    dndCheckedAt: new Date(),
  };
  it("Ravi (last donated Jun 30) can give on Nov 5", () => {
    expect(checkEligibility(base, "O+", "2026-11-05").eligible).toBe(true);
  });
  it("respects the 120-day gap for women", () => {
    const r = checkEligibility({ ...base, sex: "female", lastDonationOn: "2026-08-01" }, "O+", "2026-11-05");
    expect(r.reasons).toContain("too_soon");
  });
  it("never calls without consent or after opt-out", () => {
    const r = checkEligibility({ ...base, consentAt: null, optedOutAt: new Date() }, "O+", "2026-11-05");
    expect(r.reasons).toEqual(expect.arrayContaining(["no_consent", "opted_out"]));
  });
});
