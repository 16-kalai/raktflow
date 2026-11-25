import { NextResponse } from "next/server";
import { getDb } from "@raktflow/db";
import { recordCallResult } from "@raktflow/domain";
import { outboundWebhookSchema } from "@raktflow/sarvam";
import { hasValidApiKey } from "@/server/api-key";

/**
 * Sarvam post-call webhook. Instant-outbound webhooks are unsigned, so the URL
 * carries our API key and we only act on attempt IDs we created ourselves.
 */
export async function POST(req: Request) {
  if (!hasValidApiKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = outboundWebhookSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad payload" }, { status: 400 });
  const w = parsed.data;
  const job = await recordCallResult(getDb(), {
    attemptId: w.attempt_id,
    status: String(w.status),
    durationSec: w.duration ?? null,
    interactionId: w.interaction_id ?? null,
    transcript: (w.interaction_transcript ?? []).map((m) => ({ role: m.role === "user" ? "user" : "agent", text: m.en_text ?? "" })),
    variables: (w.final_agent_variables ?? {}) as Record<string, unknown>,
    failureReason: w.failure_reason ?? null,
  });
  return NextResponse.json({ ok: true, matched: Boolean(job) });
}
