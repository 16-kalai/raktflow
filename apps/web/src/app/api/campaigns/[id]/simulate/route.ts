import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { campaigns, getDb } from "@raktflow/db";
import { simulateBookings } from "@raktflow/domain";
import { apiMember } from "@/server/session";

/** Demo: test donors say yes, a few at a time, so the gap meter can be watched closing. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const count = Math.min(10, Math.max(1, Number(new URL(req.url).searchParams.get("count") ?? 4)));
  const db = getDb();
  const [c] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.bankId, member.bank.id), eq(campaigns.status, "active")))
    .limit(1);
  if (!c) return NextResponse.json({ error: "Campaign is not active" }, { status: 409 });
  const made = await simulateBookings(db, member.bank.id, c, count);
  return NextResponse.json({ booked: made });
}
