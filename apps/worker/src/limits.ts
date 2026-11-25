import type { Logger } from "pino";
import { getDb } from "@raktflow/db";
import { logEvent } from "@raktflow/domain";

/** In-process stand-in for a voice provider's concurrency cap (load-test mode only). */
export class ProviderLimiter {
  private active = 0;
  constructor(private readonly limit: number) {}
  tryAcquire(): boolean {
    if (this.active >= this.limit) return false;
    this.active++;
    return true;
  }
  release(): void {
    this.active = Math.max(0, this.active - 1);
  }
}

/**
 * Watches provider 429s. When they keep coming, it tells NudgeBee once (per
 * cool-down), which investigates the worker logs and proposes a lower
 * `max_concurrent_calls` in Flagsmith.
 */
export class RateLimitWatch {
  total = 0;
  private recent: number[] = [];
  private lastAlert = 0;
  constructor(private readonly log: Logger) {}

  record(concurrency: number, bankId: string): void {
    const now = Date.now();
    this.total++;
    this.recent = [...this.recent.filter((t) => now - t < 60_000), now];
    if (this.recent.length >= 3 && now - this.lastAlert > 5 * 60_000) {
      this.lastAlert = now;
      void this.alert(concurrency, bankId, this.recent.length);
    }
  }

  private async alert(concurrency: number, bankId: string, count: number) {
    const url = process.env.NUDGEBEE_RATELIMIT_WEBHOOK_URL;
    const message = `${count} voice-provider 429s in 60s at max_concurrent_calls=${concurrency}`;
    this.log.warn({ concurrency, count }, `alerting NudgeBee: ${message}`);
    await logEvent(getDb(), bankId, "ops", "voice-worker", message).catch(() => undefined);
    if (!url) return;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          type: "voice_provider_rate_limited",
          namespace: "raktflow",
          workload: "voice-worker",
          current_max_concurrent_calls: concurrency,
          suggested_max_concurrent_calls: Math.max(1, concurrency - 1),
          errors_last_minute: count,
          flag: "max_concurrent_calls",
        }),
      });
    } catch (err) {
      this.log.error({ err: (err as Error).message }, "could not reach NudgeBee");
    }
  }
}
