import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, transfusions } from "@raktflow/db";
import { apiMember } from "@/server/session";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await getDb().delete(transfusions).where(and(eq(transfusions.id, id), eq(transfusions.bankId, member.bank.id)));
  return NextResponse.json({ ok: true });
}
