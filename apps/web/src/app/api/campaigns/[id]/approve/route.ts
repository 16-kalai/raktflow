import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { campaigns, getDb } from "@raktflow/db";
import { logEvent } from "@raktflow/domain";
import { FLAG, FlagsmithAdmin, adminConfigFromEnv, refreshFlags } from "@raktflow/flags";
import { apiMember } from "@/server/session";

/**
 * Fallback approval inside RaktFlow (for when NudgeBee isn't wired up).
 * It does what the NudgeBee workflow does: turn surge_mode ON in Flagsmith.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = getDb();
  const [c] = await db
    .update(campaigns)
    .set({ approvedBy: `${member.name} (in RaktFlow)` })
    .where(and(eq(campaigns.id, id), eq(campaigns.bankId, member.bank.id), eq(campaigns.status, "pending_approval")))
    .returning();
  if (!c) return NextResponse.json({ error: "No campaign waiting for approval" }, { status: 409 });

  const cfg = adminConfigFromEnv();
  if (!cfg) {
    await db.update(campaigns).set({ status: "active", approvedAt: new Date() }).where(eq(campaigns.id, id));
    await logEvent(db, member.bank.id, "campaign", member.name, "Approved in RaktFlow (Flagsmith admin key not configured)");
    return NextResponse.json({ ok: true, flagsmith: false });
  }
  await new FlagsmithAdmin(cfg).setFlag(FLAG.surgeMode, { enabled: true });
  await refreshFlags();
  await logEvent(db, member.bank.id, "flag", member.name, "surge_mode → ON in Flagsmith (approved in RaktFlow)");
  return NextResponse.json({ ok: true, flagsmith: true });
}
