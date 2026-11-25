import { NextResponse } from "next/server";
import { getOpenSlots } from "@raktflow/domain";
import { hasValidApiKey, readParams } from "@/server/api-key";
import { donorContext, parseSpokenDate } from "@/server/tool-context";

/** Sarvam agent tool: "which slots are free on <date>?" */
async function handle(req: Request) {
  if (!hasValidApiKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = await readParams(req);
  const ctx = await donorContext(p.donor_ref ?? p.donorRef ?? "");
  if (!ctx?.campaign) return NextResponse.json({ available: false, message: "No donation drive is open right now." });
  const { db, donor, campaign } = ctx;
  const date = parseSpokenDate(p.date, campaign.windowStart.slice(0, 7));
  const from = date ?? campaign.windowStart;
  const to = date ?? campaign.windowEnd;
  const open = await getOpenSlots(db, donor.bankId, from, to);
  const shown = open.slice(0, 4);
  const message = shown.length
    ? `Open slots: ${shown.map((s) => `${s.date} at ${s.time}`).join(", ")}.`
    : `No open slots ${date ? `on ${date}` : "in the drive window"}. The drive runs ${campaign.windowStart} to ${campaign.windowEnd}.`;
  return NextResponse.json({ available: shown.length > 0, slots: shown.map((s) => ({ date: s.date, time: s.time })), message });
}

export { handle as GET, handle as POST };
