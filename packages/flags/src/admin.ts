/**
 * Flagsmith Management API: used to bootstrap flags and segments, to switch
 * surge mode off when a campaign completes, and to read the audit log for the
 * in-app "who changed what" feed. Auth: `Authorization: Api-Key <org key>`.
 */
export interface AdminConfig {
  apiKey: string;
  projectId: string;
  environmentKey: string;
  baseUrl: string;
}

export function adminConfigFromEnv(): AdminConfig | null {
  const apiKey = process.env.FLAGSMITH_ADMIN_API_KEY;
  const projectId = process.env.FLAGSMITH_PROJECT_ID;
  const environmentKey = process.env.FLAGSMITH_ENVIRONMENT_KEY;
  if (!apiKey || !projectId || !environmentKey) return null;
  return {
    apiKey,
    projectId,
    environmentKey,
    baseUrl: (process.env.FLAGSMITH_ADMIN_URL ?? "https://api.flagsmith.com").replace(/\/$/, ""),
  };
}

export class FlagsmithAdmin {
  constructor(private readonly cfg: AdminConfig) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Api-Key ${this.cfg.apiKey}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Flagsmith ${method} ${path} → ${res.status}: ${await res.text()}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  async findFeature(name: string): Promise<{ id: number; name: string } | null> {
    const page = await this.request<{ results: { id: number; name: string }[] }>(
      "GET",
      `/api/v1/projects/${this.cfg.projectId}/features/?search=${encodeURIComponent(name)}`,
    );
    return page.results.find((f) => f.name === name) ?? null;
  }

  async createFeature(input: { name: string; description: string; defaultEnabled: boolean; initialValue?: string | number | null }) {
    return this.request<{ id: number }>("POST", `/api/v1/projects/${this.cfg.projectId}/features/`, {
      name: input.name,
      description: input.description,
      default_enabled: input.defaultEnabled,
      initial_value: input.initialValue ?? null,
      type: "STANDARD",
    });
  }

  async listSegments(): Promise<{ id: number; name: string }[]> {
    const page = await this.request<{ results: { id: number; name: string }[] }>(
      "GET",
      `/api/v1/projects/${this.cfg.projectId}/segments/?page_size=100`,
    );
    return page.results;
  }

  async createSegment(name: string, description: string, conditions: { property: string; operator: string; value: string }[]) {
    return this.request<{ id: number }>("POST", `/api/v1/projects/${this.cfg.projectId}/segments/`, {
      name,
      description,
      project: Number(this.cfg.projectId),
      rules: [{ type: "ALL", rules: [{ type: "ALL", conditions }], conditions: [] }],
    });
  }

  /** Set a flag's environment default (enabled and/or value). */
  async setFlag(name: string, change: { enabled?: boolean; value?: string | number | boolean }) {
    const feature = await this.findFeature(name);
    if (!feature) throw new Error(`Flag ${name} not found`);
    const environmentDefault: Record<string, unknown> = {};
    if (change.enabled !== undefined) environmentDefault.enabled = change.enabled;
    if (change.value !== undefined) environmentDefault.value = typedValue(change.value);
    return this.request("PATCH", `/api/__future__/environments/${this.cfg.environmentKey}/features/${feature.id}/`, {
      environment_default: environmentDefault,
    });
  }

  async setSegmentOverride(name: string, segmentId: number, enabled: boolean, priority = 10) {
    const feature = await this.findFeature(name);
    if (!feature) throw new Error(`Flag ${name} not found`);
    return this.request("PATCH", `/api/__future__/environments/${this.cfg.environmentKey}/features/${feature.id}/`, {
      segment_overrides: [{ segment: { id: segmentId }, enabled, priority }],
    });
  }

  async auditLog(pageSize = 20): Promise<AuditEntry[]> {
    const page = await this.request<{ results: RawAudit[] }>(
      "GET",
      `/api/v1/projects/${this.cfg.projectId}/audit/?page_size=${pageSize}`,
    );
    return page.results.map((r) => ({
      id: r.id,
      at: r.created_date,
      message: r.log,
      author: r.author ? [r.author.first_name, r.author.last_name].filter(Boolean).join(" ") || r.author.email : "API key",
    }));
  }
}

interface RawAudit {
  id: number;
  created_date: string;
  log: string;
  author: { email: string; first_name?: string; last_name?: string } | null;
}

export interface AuditEntry {
  id: number;
  at: string;
  message: string;
  author: string;
}

function typedValue(value: string | number | boolean) {
  if (typeof value === "number") return { type: "integer", value: String(value) };
  if (typeof value === "boolean") return { type: "boolean", value: String(value) };
  return { type: "string", value };
}
