import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Shared-secret check for machine callers (Sarvam tools, NudgeBee steps). */
export function hasValidApiKey(req: Request): boolean {
  const expected = process.env.RAKTFLOW_API_KEY;
  if (!expected) return false;
  const given =
    req.headers.get("x-api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(req.url).searchParams.get("key") ??
    "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Tool payloads vary by caller; read JSON body and query string together. */
export async function readParams(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  new URL(req.url).searchParams.forEach((v, k) => (out[k] = v));
  if (req.method !== "GET") {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      const flat = (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) {
          if (v && typeof v === "object" && !Array.isArray(v)) flat(v as Record<string, unknown>);
          else if (v !== null && v !== undefined) out[k] = String(v);
        }
      };
      flat(body);
    } catch {
      /* empty body */
    }
  }
  return out;
}
