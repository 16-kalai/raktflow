import { NextResponse } from "next/server";
import { apiMember } from "@/server/session";
import { buildOverview } from "@/server/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await buildOverview(member.bank), { headers: { "Cache-Control": "no-store" } });
}
