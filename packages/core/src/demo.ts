import { addDays, type ISODate } from "./dates";
import type {
  BloodGroup,
  DonationCamp,
  ExpectedYield,
  FestivalWindow,
  PerGroup,
  ScheduledTransfusion,
  StockLot,
} from "./types";

/**
 * Demo scenario: "Sahyog Blood Centre, Pune" (fictional bank, demo data),
 * about 600 units a month. Used by the seed script and by the tests, so the
 * numbers on screen and the numbers we test are the same numbers.
 */
export const DEMO_AS_OF: ISODate = "2026-10-20";
export const DIWALI_2026: ISODate = "2026-11-08";

export const DEMO_GROUP_MIX: PerGroup<number> = {
  "O+": 0.35, "B+": 0.31, "A+": 0.21, "AB+": 0.08,
  "O-": 0.02, "B-": 0.015, "A-": 0.01, "AB-": 0.005,
};

/** Normal red-cell usage per day (≈ 20 units/day, ≈ 600/month). */
export const DEMO_USAGE_PER_DAY: PerGroup<number> = {
  "O+": 7, "B+": 6.2, "A+": 4.2, "AB+": 1.6,
  "O-": 0.4, "B-": 0.3, "A-": 0.2, "AB-": 0.1,
};

export const DEMO_WALK_IN_PER_DAY = 8;
export const DEMO_SHELF_LIFE_DAYS = 42;
export const DEMO_SAFE_STOCK_DAYS = 3;
export const DEMO_HORIZON_DAYS = 28;
export const DEMO_YIELD: ExpectedYield = { showUp: 0.7, passScreening: 0.89 };

/** Festival windows by state. Collection factors are editable assumptions (Flagsmith). */
export const DEMO_FESTIVALS_BY_STATE: Record<string, FestivalWindow[]> = {
  MH: [{ name: "Diwali travel", start: "2026-10-28", end: "2026-11-15", collectionFactor: 0.4, demandFactor: 1 }],
  WB: [{ name: "Durga Puja to Jagaddhatri Puja", start: "2026-10-15", end: "2026-11-20", collectionFactor: 0.45, demandFactor: 1 }],
};

/** When each state's festive season starts mattering for planning (Flagsmith segment windows). */
export const DEMO_FESTIVE_SEASON_BY_STATE: Record<string, { start: ISODate; end: ISODate }> = {
  MH: { start: "2026-10-15", end: "2026-11-20" },
  WB: { start: "2026-10-01", end: "2026-11-25" },
};

export const DEMO_CAMPS: DonationCamp[] = [
  { name: "Fergusson College camp", date: "2026-10-24", expectedUnits: 40, status: "planned" },
  { name: "COEP college camp", date: "2026-10-30", expectedUnits: 45, status: "cancelled", cancelReason: "COEP camp (Diwali vacation)" },
  { name: "Hinjewadi IT park camp", date: "2026-11-05", expectedUnits: 50, status: "cancelled", cancelReason: "Hinjewadi IT camp (Diwali leave)" },
  { name: "Post-Diwali community camp", date: "2026-11-16", expectedUnits: 40, status: "planned" },
];

export const DEMO_TRANSFUSIONS: ScheduledTransfusion[] = [
  { label: "Aarav, 9 · thalassemia (illustrative)", group: "O+", date: "2026-11-14", units: 1 },
];

/** Stock on the demo date, before the festive drop. */
const DEMO_STOCK: PerGroup<number> = {
  "O+": 124, "B+": 160, "A+": 110, "AB+": 45,
  "O-": 14, "B-": 10, "A-": 8, "AB-": 5,
};

/** Spread each group's stock over lots collected in the last few weeks. */
export function demoStockLots(asOf: ISODate = DEMO_AS_OF): StockLot[] {
  const offsets = [9, 15, 21, 27, 33, 39];
  const lots: StockLot[] = [];
  for (const [group, total] of Object.entries(DEMO_STOCK) as [BloodGroup, number][]) {
    const per = total / offsets.length;
    offsets.forEach((days, i) => {
      // Keep whole units; put the remainder on the freshest lot.
      const units = i === offsets.length - 1 ? total - Math.floor(per) * (offsets.length - 1) : Math.floor(per);
      lots.push({ group, units, expiresOn: addDays(asOf, days) });
    });
  }
  return lots;
}
