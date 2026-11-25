import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { DEMO_AS_OF } from "@raktflow/core";
import { banks, bookings, campaigns, donors, events, getDb, slots } from "@raktflow/db";
import { logEvent } from "@raktflow/domain";
import { FLAG, FlagsmithAdmin, adminConfigFromEnv, refreshFlags } from "@raktflow/flags";
import { apiMember } from "@/server/session";

/** Demo banks only: back to Oct 20 with no campaign, bookings or calls, and surge_mode OFF. */
export async function POST() {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!member.bank.isDemo) return NextResponse.json({ error: "Only demo banks can be reset" }, { status: 400 });
  const db = getDb();
  const bankId = member.bank.id;
  await db.transaction(async (tx) => {
    await tx.delete(bookings).where(eq(bookings.bankId, bankId));
    await tx.delete(campaigns).where(eq(campaigns.bankId, bankId)); // cascades to call jobs
    await tx.update(slots).set({ booked: 0 }).where(eq(slots.bankId, bankId));
    await tx.update(donors).set({ optedOutAt: null, deferredUntil: null }).where(eq(donors.bankId, bankId));
    await tx.delete(events).where(eq(events.bankId, bankId));
    await tx.update(banks).set({ demoDate: DEMO_AS_OF }).where(eq(banks.id, bankId));
  });
  const cfg = adminConfigFromEnv();
  if (cfg) {
    const admin = new FlagsmithAdmin(cfg);
    await admin.setFlag(FLAG.surgeMode, { enabled: false });
    await admin.setFlag(FLAG.maxConcurrentCalls, { enabled: true, value: 4 });
    await refreshFlags();
  }
  await logEvent(db, bankId, "system", member.name, "Demo reset to 20 Oct 2026");
  return NextResponse.json({ ok: true });
}
