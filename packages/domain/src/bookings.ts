import { and, asc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { addDays, type ISODate } from "@raktflow/core";
import { bookings, callJobs, donors, slots, type Database } from "@raktflow/db";
import { logEvent } from "./events";

export interface SlotView {
  id: string;
  startsAt: Date;
  date: ISODate;
  time: string;
  remaining: number;
}

const ist = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const istTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

/** Open slots on one date (IST), or across a date range. */
export async function getOpenSlots(db: Database, bankId: string, from: ISODate, to: ISODate = from): Promise<SlotView[]> {
  const rows = await db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.bankId, bankId),
        gte(slots.startsAt, new Date(`${from}T00:00:00+05:30`)),
        lt(slots.startsAt, new Date(`${addDays(to, 1)}T00:00:00+05:30`)),
        gt(slots.capacity, slots.booked),
      ),
    )
    .orderBy(asc(slots.startsAt));
  return rows.map((s) => ({ id: s.id, startsAt: s.startsAt, date: ist(s.startsAt), time: istTime(s.startsAt), remaining: s.capacity - s.booked }));
}

export class SlotUnavailableError extends Error {}

export interface BookSlotInput {
  bankId: string;
  donorRef: string;
  /** Exact slot, or a date + "HH:MM" in IST as the voice agent says it. */
  slotId?: string;
  date?: ISODate;
  time?: string;
  campaignId?: string | null;
  /** Sarvam interaction ID for real calls, so a retried tool call never double-books. */
  idempotencyKey: string;
  simulated?: boolean;
  actor: string;
}

export interface BookSlotResult {
  bookingId: string;
  slotStartsAt: Date;
  alreadyBooked: boolean;
}

/**
 * Books one donor into one slot. Safe under concurrency (the slot row is
 * locked while its count changes) and safe to retry (idempotency key).
 */
export async function bookSlot(db: Database, input: BookSlotInput): Promise<BookSlotResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: bookings.id, slotId: bookings.slotId })
      .from(bookings)
      .where(eq(bookings.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing) {
      const [slot] = await tx.select().from(slots).where(eq(slots.id, existing.slotId));
      return { bookingId: existing.id, slotStartsAt: slot!.startsAt, alreadyBooked: true };
    }

    const [donor] = await tx
      .select()
      .from(donors)
      .where(and(eq(donors.ref, input.donorRef), eq(donors.bankId, input.bankId)))
      .limit(1);
    if (!donor) throw new SlotUnavailableError(`Unknown donor ${input.donorRef}`);

    const slotFilter = input.slotId
      ? eq(slots.id, input.slotId)
      : eq(slots.startsAt, new Date(`${input.date}T${(input.time ?? "10:00").padStart(5, "0")}:00+05:30`));
    const [slot] = await tx
      .select()
      .from(slots)
      .where(and(eq(slots.bankId, input.bankId), slotFilter))
      .for("update")
      .limit(1);
    if (!slot) throw new SlotUnavailableError("No such slot");
    if (slot.booked >= slot.capacity) throw new SlotUnavailableError("Slot is full");

    const [booking] = await tx
      .insert(bookings)
      .values({
        bankId: input.bankId,
        campaignId: input.campaignId ?? null,
        donorId: donor.id,
        slotId: slot.id,
        bloodGroup: donor.bloodGroup,
        idempotencyKey: input.idempotencyKey,
        simulated: input.simulated ?? false,
      })
      .onConflictDoNothing()
      .returning();
    if (!booking) {
      // Same donor already booked in this campaign.
      const [prior] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.donorId, donor.id), input.campaignId ? eq(bookings.campaignId, input.campaignId) : sql`true`))
        .limit(1);
      return { bookingId: prior?.id ?? "", slotStartsAt: slot.startsAt, alreadyBooked: true };
    }
    await tx.update(slots).set({ booked: sql`${slots.booked} + 1` }).where(eq(slots.id, slot.id));
    if (input.campaignId) {
      await tx
        .update(callJobs)
        .set({ outcome: "booked" })
        .where(and(eq(callJobs.campaignId, input.campaignId), eq(callJobs.donorId, donor.id)));
    }
    await logEvent(tx as unknown as Database, input.bankId, "booking", input.actor, `${donor.bloodGroup} donor ${donor.ref} booked for ${ist(slot.startsAt)} ${istTime(slot.startsAt)}`, {
      donorRef: donor.ref,
      simulated: input.simulated ?? false,
    });
    return { bookingId: booking.id, slotStartsAt: slot.startsAt, alreadyBooked: false };
  });
}
