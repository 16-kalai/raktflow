import "server-only";
import { and, eq } from "drizzle-orm";
import { campaigns, donors, getDb } from "@raktflow/db";

/** Resolve the donor and their bank's active campaign from a pseudonymous ref. */
export async function donorContext(donorRef: string) {
  const db = getDb();
  const [donor] = await db.select().from(donors).where(eq(donors.ref, donorRef)).limit(1);
  if (!donor) return null;
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.bankId, donor.bankId), eq(campaigns.bloodGroup, donor.bloodGroup), eq(campaigns.status, "active")))
    .limit(1);
  return { db, donor, campaign: campaign ?? null };
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

/** Accepts "2026-11-05", "5 November", "Nov 5", or just "5" (current campaign month). */
export function parseSpokenDate(raw: string | undefined, fallbackYearMonth: string): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const day = s.match(/\b(\d{1,2})(st|nd|rd|th)?\b/)?.[1];
  const mon = Object.keys(MONTHS).find((m) => s.includes(m));
  if (!day) return null;
  const ym = mon ? `${fallbackYearMonth.slice(0, 4)}-${MONTHS[mon]}` : fallbackYearMonth;
  return `${ym}-${day.padStart(2, "0")}`;
}

/** "10", "10 am", "10:00", "5 pm", "17:00" → "HH:MM" (24h). */
export function parseSpokenTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (!m[3] && h >= 1 && h <= 7) h += 12; // "5" on a donation call means 5 pm
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}
