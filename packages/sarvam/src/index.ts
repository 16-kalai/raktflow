import { z } from "zod";

/**
 * Sarvam Voice Agents (Samvaad) client: start an outbound call and read the
 * transcript. Voice Agents live on apps.sarvam.ai and use `X-API-Key`.
 */
export interface SarvamConfig {
  apiKey: string;
  orgId: string;
  workspaceId: string;
  appId: string;
  appVersion: number;
  connectionId: string;
  agentPhoneNumber: string;
  baseUrl: string;
}

export function sarvamConfigFromEnv(): SarvamConfig | null {
  const e = process.env;
  const required = [e.SARVAM_VOICE_API_KEY, e.SARVAM_ORG_ID, e.SARVAM_WORKSPACE_ID, e.SARVAM_APP_ID, e.SARVAM_CONNECTION_ID, e.SARVAM_AGENT_PHONE];
  if (required.some((v) => !v)) return null;
  return {
    apiKey: e.SARVAM_VOICE_API_KEY!,
    orgId: e.SARVAM_ORG_ID!,
    workspaceId: e.SARVAM_WORKSPACE_ID!,
    appId: e.SARVAM_APP_ID!,
    appVersion: Number(e.SARVAM_APP_VERSION ?? 1),
    connectionId: e.SARVAM_CONNECTION_ID!,
    agentPhoneNumber: e.SARVAM_AGENT_PHONE!,
    baseUrl: (e.SARVAM_APPS_URL ?? "https://apps.sarvam.ai").replace(/\/$/, ""),
  };
}

export const SARVAM_LANGUAGES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  kn: "Kannada",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  gu: "Gujarati",
  ml: "Malayalam",
  pa: "Punjabi",
  od: "Odia",
};

/** Thrown when Sarvam rejects a call because we are over its concurrency or rate limit. */
export class SarvamRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SarvamRateLimitError";
  }
}

export interface OutboundCallInput {
  phone: string;
  language: string;
  /** Values the agent can use in its prompt and tools (donor ref, bank, script, questions). */
  variables: Record<string, string>;
  webhookUrl: string;
  webhookMetadata: Record<string, string>;
}

export class SarvamVoice {
  constructor(private readonly cfg: SarvamConfig) {}

  async startOutboundCall(input: OutboundCallInput): Promise<{ attemptId: string }> {
    const url = `${this.cfg.baseUrl}/api/outbounds/v1/orgs/${this.cfg.orgId}/workspaces/${this.cfg.workspaceId}/outbounds`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "X-API-Key": this.cfg.apiKey, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        app_config: {
          app_id: this.cfg.appId,
          app_version: this.cfg.appVersion,
          app_type: "agent",
          connection_config: { connection_id: this.cfg.connectionId, agent_phone_number: this.cfg.agentPhoneNumber },
          agent_variables: input.variables,
          app_overrides: { initial_language_name: SARVAM_LANGUAGES[input.language] ?? "English" },
        },
        user_config: { user_phone_number: input.phone },
        webhook_config: { url: input.webhookUrl, metadata: input.webhookMetadata },
      }),
    });
    const text = await res.text();
    if (res.status === 429) throw new SarvamRateLimitError(text || "Sarvam 429");
    if (!res.ok) {
      if (/concurren|rate.?limit|too many/i.test(text)) throw new SarvamRateLimitError(text);
      throw new Error(`Sarvam outbound ${res.status}: ${text}`);
    }
    const body = z.object({ attempt_id: z.string() }).parse(JSON.parse(text));
    return { attemptId: body.attempt_id };
  }

  async getTranscript(interactionId: string): Promise<{ role: "agent" | "user"; text: string }[]> {
    const url = `${this.cfg.baseUrl}/api/analytics/v1/${this.cfg.orgId}/${this.cfg.workspaceId}/${this.cfg.appId}/transcripts/${encodeURIComponent(interactionId)}`;
    const res = await fetch(url, { headers: { "X-API-Key": this.cfg.apiKey }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Sarvam transcript ${res.status}`);
    const body = (await res.json()) as { messages?: { role: string; content: string }[] };
    return (body.messages ?? []).map((m) => ({ role: m.role === "user" ? "user" : "agent", text: m.content }));
  }
}

/** Shape of Sarvam's post-call webhook for instant outbound calls. */
export const outboundWebhookSchema = z.object({
  attempt_id: z.string(),
  status: z.enum(["connected", "no_answer", "busy", "failed"]).or(z.string()),
  duration: z.number().nullable().optional(),
  interaction_id: z.string().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  final_agent_variables: z.record(z.string(), z.unknown()).nullable().optional(),
  webhook_config: z.object({ metadata: z.record(z.string(), z.unknown()).nullable().optional() }).partial().nullable().optional(),
  interaction_transcript: z
    .array(z.object({ role: z.string(), en_text: z.string().nullable().optional() }))
    .nullable()
    .optional(),
});
export type OutboundWebhook = z.infer<typeof outboundWebhookSchema>;
