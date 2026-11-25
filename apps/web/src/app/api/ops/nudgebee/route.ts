import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { campaigns, getDb } from "@raktflow/db";
import { logEvent } from "@raktflow/domain";
import { hasValidApiKey, readParams } from "@/server/api-key";

/**
 * Optional callback from a NudgeBee workflow step: records who approved and
 * what NudgeBee did, so the dashboard's activity feed tells the whole story.
 */
export async function POST(req: Request) {
  if (!hasValidApiKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = await readParams(req);
  const db = getDb();
  let bankId: string | null = null;
  if (p.campaign_id) {
    const [c] = await db.select().from(campaigns).where(eq(campaigns.id, p.campaign_id)).limit(1);
    if (c) {
      bankId = c.bankId;
      if (p.approved_by) {
        // NudgeBee reports the approver as a user ID; show a role, not an opaque ID.
        const approver = /^[0-9a-f-]{36}/i.test(p.approved_by) ? "Medical officer (NudgeBee)" : p.approved_by;
        await db.update(campaigns).set({ approvedBy: approver, nudgebeeRunRef: p.run_id ?? null }).where(eq(campaigns.id, c.id));
      }
    }
  }
  await logEvent(db, bankId, "nudgebee", "NudgeBee", p.message ?? `Workflow step: ${p.step ?? "update"}`, p);
  return NextResponse.json({ ok: true });
}
