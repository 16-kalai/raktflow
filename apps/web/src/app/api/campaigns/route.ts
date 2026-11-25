import { NextResponse } from "next/server";
import { z } from "zod";
import { BLOOD_GROUPS } from "@raktflow/core";
import { getDb } from "@raktflow/db";
import { bankToday, loadBankForecast, raiseShortage } from "@raktflow/domain";
import { apiMember } from "@/server/session";
import { bankFlags } from "@/server/overview";

const body = z.object({ group: z.enum(BLOOD_GROUPS) });

/** Coordinator raises a forecast shortage: creates the campaign and sends it to NudgeBee. */
export async function POST(req: Request) {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid blood group" }, { status: 400 });
  const db = getDb();
  const today = bankToday(member.bank);
  const flags = await bankFlags(member.bank, today);
  const fc = await loadBankForecast(db, member.bank, flags);
  try {
    const result = await raiseShortage(db, member.bank, parsed.data.group, fc, member.name);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
