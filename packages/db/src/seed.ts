import { config } from "dotenv";
import { eq } from "drizzle-orm";
import {
  BLOOD_GROUPS,
  DEMO_AS_OF,
  DEMO_CAMPS,
  DEMO_FESTIVALS_BY_STATE,
  DEMO_GROUP_MIX,
  DEMO_TRANSFUSIONS,
  DEMO_USAGE_PER_DAY,
  DEMO_WALK_IN_PER_DAY,
  addDays,
  demoStockLots,
  type BloodGroup,
} from "@raktflow/core";
import { closeDb, getDb } from "./index";
import * as s from "./schema";

config({ path: new URL("../../../.env.local", import.meta.url).pathname });

/**
 * Demo data only. Donors are synthetic: their phone numbers are deliberately
 * invalid ("+91-00000-…") so they can never be dialled. The only real number
 * is DEMO_DONOR_PHONE, a teammate who agreed to take the demo call.
 */
const DEMO_SLUG = "sahyog-pune";

// Small deterministic PRNG so every seed produces the same donors.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;

const FIRST = ["Aditya", "Priya", "Rohan", "Sneha", "Vikram", "Ananya", "Kunal", "Meera", "Arjun", "Pooja", "Siddharth", "Neha", "Rahul", "Kavya", "Omkar", "Isha", "Nikhil", "Shruti", "Varun", "Tanvi"];
const LAST = ["Patil", "Deshmukh", "Joshi", "Kulkarni", "Shinde", "Pawar", "Jadhav", "Gokhale", "Sharma", "Iyer", "Nair", "Khan", "Gupta", "More", "Bhosale"];
const FEMALE = new Set(["Priya", "Sneha", "Ananya", "Meera", "Pooja", "Neha", "Kavya", "Isha", "Shruti", "Tanvi"]);

function groupFor(r: number): BloodGroup {
  let acc = 0;
  for (const g of BLOOD_GROUPS) {
    acc += DEMO_GROUP_MIX[g];
    if (r <= acc) return g;
  }
  return "O+";
}

async function main() {
  const db = getDb({ max: 2 });
  await db.delete(s.banks).where(eq(s.banks.slug, DEMO_SLUG));
  await db.delete(s.festivalWindows);

  const [bank] = await db
    .insert(s.banks)
    .values({
      slug: DEMO_SLUG,
      name: "Sahyog Blood Centre",
      city: "Pune",
      state: "MH",
      demoDate: DEMO_AS_OF,
      stockAsOf: DEMO_AS_OF,
      usagePerDay: DEMO_USAGE_PER_DAY,
      groupMix: DEMO_GROUP_MIX,
      walkInPerDay: DEMO_WALK_IN_PER_DAY,
      isDemo: true,
    })
    .returning();
  if (!bank) throw new Error("bank insert failed");

  await db.insert(s.festivalWindows).values(
    Object.entries(DEMO_FESTIVALS_BY_STATE).flatMap(([state, windows]) =>
      windows.map((w) => ({ state, name: w.name, start: w.start, end: w.end, collectionFactor: w.collectionFactor, demandFactor: w.demandFactor })),
    ),
  );

  await db.insert(s.stockLots).values(demoStockLots().map((l) => ({ bankId: bank.id, bloodGroup: l.group, units: l.units, expiresOn: l.expiresOn })));
  await db.insert(s.camps).values(DEMO_CAMPS.map((c) => ({ bankId: bank.id, ...c, cancelReason: c.cancelReason ?? null })));
  await db.insert(s.transfusions).values(DEMO_TRANSFUSIONS.map((t) => ({ bankId: bank.id, label: t.label, bloodGroup: t.group, date: t.date, units: t.units })));

  // Donation slots: Nov 1–7, four times a day.
  const slotRows = [];
  for (let d = 0; d < 7; d++) {
    const day = addDays("2026-11-01", d);
    for (const time of ["10:00", "12:00", "15:00", "17:00"]) {
      slotRows.push({ bankId: bank.id, startsAt: new Date(`${day}T${time}:00+05:30`), capacity: 4 });
    }
  }
  await db.insert(s.slots).values(slotRows);

  // The real demo contact.
  const now = new Date();
  const demoPhone = process.env.DEMO_DONOR_PHONE ?? "+91-00000-00001";
  const donorRows: (typeof s.donors.$inferInsert)[] = [
    {
      bankId: bank.id,
      ref: "donor_8f3a",
      name: process.env.DEMO_DONOR_NAME ?? "Ravi",
      phone: demoPhone,
      bloodGroup: "O+",
      sex: "male",
      language: "en",
      donorType: "regular",
      city: "Pune",
      lastDonationOn: "2026-06-30",
      consentAt: now,
      dndCheckedAt: now,
      isDemoContact: true,
    },
  ];

  // Synthetic donors (never dialled for real).
  for (let i = 0; i < 420; i++) {
    const first = pick(FIRST);
    const sex = FEMALE.has(first) ? "female" : "male";
    const daysAgo = 60 + Math.floor(rand() * 300);
    donorRows.push({
      bankId: bank.id,
      ref: `donor_${(0x9000 + i).toString(16)}`,
      name: `${first} ${pick(LAST)}`,
      phone: `+91-00000-${String(10000 + i)}`,
      bloodGroup: groupFor(rand()),
      sex,
      language: pick(["en", "hi", "mr", "mr", "hi"] as const),
      donorType: rand() < 0.15 ? "first_time" : "regular",
      city: "Pune",
      lastDonationOn: addDays(DEMO_AS_OF, -daysAgo),
      consentAt: rand() < 0.9 ? now : null,
      dndCheckedAt: now,
    });
  }
  await db.insert(s.donors).values(donorRows);

  await db.insert(s.events).values({
    bankId: bank.id,
    kind: "system",
    actor: "seed",
    message: "Demo bank created: Sahyog Blood Centre, Pune (demo data)",
  });

  console.log(`Seeded ${bank.name}: ${donorRows.length} donors, ${slotRows.length} slots.`);
  await closeDb();
}

await main();
