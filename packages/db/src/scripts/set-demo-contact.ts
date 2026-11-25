import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { closeDb, donors, getDb } from "../index";

config({ path: new URL("../../../../.env.local", import.meta.url).pathname });

/** Point the demo donor (donor_8f3a) at the real phone in DEMO_DONOR_PHONE, without reseeding. */
const phone = process.env.DEMO_DONOR_PHONE;
if (!phone || !/^\+\d{10,15}$/.test(phone)) {
  console.error("Set DEMO_DONOR_PHONE in .env.local in E.164 format, e.g. +919876543210");
  process.exit(1);
}
const db = getDb({ max: 1 });
const [row] = await db
  .update(donors)
  .set({ phone, name: process.env.DEMO_DONOR_NAME ?? "Ravi", isDemoContact: true, consentAt: new Date(), dndCheckedAt: new Date() })
  .where(eq(donors.ref, "donor_8f3a"))
  .returning({ ref: donors.ref, name: donors.name });
console.log(row ? `Demo contact ${row.ref} (${row.name}) now uses the number ending ${phone.slice(-4)}` : "donor_8f3a not found");
await closeDb();
