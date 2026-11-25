import { NextResponse } from "next/server";
import { bookSlot, SlotUnavailableError } from "@raktflow/domain";
import { hasValidApiKey, readParams } from "@/server/api-key";
import { donorContext, parseSpokenDate, parseSpokenTime } from "@/server/tool-context";

/** Sarvam agent tool: book the donor into a slot. Idempotent on the interaction ID. */
export async function POST(req: Request) {
  if (!hasValidApiKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = await readParams(req);
  const donorRef = p.donor_ref ?? p.donorRef ?? "";
  const ctx = await donorContext(donorRef);
  if (!ctx?.campaign) return NextResponse.json({ booked: false, message: "No donation drive is open right now." });
  const { db, donor, campaign } = ctx;
  const date = parseSpokenDate(p.date, campaign.windowStart.slice(0, 7));
  const time = parseSpokenTime(p.time);
  if (!date || !time) return NextResponse.json({ booked: false, message: "Please confirm the date and time." });
  const interaction = p.interaction_id ?? p.interactionId ?? p.call_id ?? `${donorRef}:${date}:${time}`;
  try {
    const r = await bookSlot(db, {
      bankId: donor.bankId,
      donorRef,
      date,
      time,
      campaignId: campaign.id,
      idempotencyKey: `sarvam:${interaction}`,
      actor: "sarvam voice agent",
    });
    return NextResponse.json({ booked: true, already_booked: r.alreadyBooked, date, time, message: `Booked for ${date} at ${time}.` });
  } catch (err) {
    if (err instanceof SlotUnavailableError) return NextResponse.json({ booked: false, message: `${err.message}. Offer another time.` });
    throw err;
  }
}
