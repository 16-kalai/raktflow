import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { banks, getDb } from "@raktflow/db";
import { apiMember } from "@/server/session";

const body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** Demo clock: move "today" for a demo bank so the festive season can be replayed. */
export async function POST(req: Request) {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!member.bank.isDemo) return NextResponse.json({ error: "Only demo banks have a movable clock" }, { status: 400 });
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  await getDb().update(banks).set({ demoDate: parsed.data.date }).where(eq(banks.id, member.bank.id));
  return NextResponse.json({ ok: true });
}
