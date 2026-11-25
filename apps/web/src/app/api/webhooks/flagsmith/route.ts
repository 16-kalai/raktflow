import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "@raktflow/db";
import { logEvent } from "@raktflow/domain";
import { refreshFlags } from "@raktflow/flags";

/**
 * Flagsmith audit-log webhook (HMAC-SHA256 signed). Refreshes our flag cache
 * at once, so a change in Flagsmith reaches RaktFlow in about a second, and
 * shows up in the activity feed with who made it.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.FLAGSMITH_WEBHOOK_SECRET;
  if (secret) {
    const given = req.headers.get("x-flagsmith-signature") ?? "";
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const ok = given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  await refreshFlags();
  try {
    const body = JSON.parse(raw) as { data?: { log?: string; author?: { email?: string; first_name?: string } | null } };
    const log = body.data?.log;
    if (log) {
      const author = body.data?.author?.first_name || body.data?.author?.email || "API key";
      await logEvent(getDb(), null, "flag", `Flagsmith · ${author}`, log);
    }
  } catch {
    /* ignore malformed audit payloads after refreshing */
  }
  return NextResponse.json({ ok: true });
}
