"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Flag,
  Loader2,
  LogOut,
  PhoneCall,
  Play,
  ShieldCheck,
  Siren,
  Sparkles,
  Users,
} from "lucide-react";
import { DIWALI_2026, addDays, diffDays } from "@raktflow/core";
import { authClient } from "@/lib/auth-client";
import { cn, istTime, shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Logo } from "@/components/logo";
import { ForecastChart } from "./forecast-chart";
import type { OverviewData } from "./types";

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as OverviewData;
};

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

const CLOCK_START = "2026-10-01";
const CLOCK_END = "2026-11-20";

export function Dashboard({ userName, role }: { userName: string; role: string }) {
  const router = useRouter();
  const { data, error, mutate } = useSWR("/api/overview", fetcher, { refreshInterval: 2000 });

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto size-6 text-destructive" />
          <p className="mt-2 font-medium">Couldn&apos;t load the dashboard</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <Logo />
            <Separator orientation="vertical" className="h-6" />
            {data ? (
              <div className="text-sm">
                <span className="font-medium">{data.bank.name}</span>
                <span className="text-muted-foreground"> · {data.bank.city}, {data.bank.state}</span>
                {data.bank.isDemo && <Badge variant="outline" className="ml-2">demo data</Badge>}
              </div>
            ) : (
              <Skeleton className="h-5 w-56" />
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {userName} · {role.replace("_", " ")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Log out"
              onClick={async () => {
                await authClient.signOut();
                router.replace("/login");
              }}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        {!data ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-28 lg:col-span-3" />
            <Skeleton className="h-96 lg:col-span-2" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <>
            <ClockBar data={data} onChange={() => mutate()} />
            <GroupGrid data={data} />
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {data.focus.group} stock, next {data.focus.days.length} days
                    {data.focus.status === "short" && <Badge variant="destructive">shortage ahead</Badge>}
                  </CardTitle>
                  <CardDescription>
                    Today + coming in − used − expiring, day by day. Safe stock = {data.flags.forecastConfig.safeStockDays} days of normal use.
                  </CardDescription>
                  <CardAction>
                    <Legend withBookings={data.focus.bookedCount > 0} />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <ForecastChart data={data} />
                  <WhyBox data={data} />
                </CardContent>
              </Card>
              <GapCard data={data} onChange={() => mutate()} />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <CallsCard data={data} />
              <FlagsCard data={data} />
              <ActivityCard data={data} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Legend({ withBookings }: { withBookings: boolean }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-muted-foreground" />if nothing changes</span>
      {withBookings && <span className="flex items-center gap-1"><span className="h-1 w-4 rounded bg-success" />with RaktFlow</span>}
      <span className="flex items-center gap-1"><span className="h-0 w-4 border-t-2 border-dashed border-destructive" />safe</span>
    </div>
  );
}

/* ───────────── Demo clock + Flagsmith state ───────────── */

function ClockBar({ data, onChange }: { data: OverviewData; onChange: () => void }) {
  const total = diffDays(CLOCK_START, CLOCK_END);
  const [value, setValue] = useState(diffDays(CLOCK_START, data.today));
  const [saving, setSaving] = useState(false);
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setValue(diffDays(CLOCK_START, data.today));
  }, [data.today]);
  const shown = addDays(CLOCK_START, value);
  const toDiwali = diffDays(shown, DIWALI_2026);

  async function commit(v: number) {
    dragging.current = false;
    setSaving(true);
    try {
      await post("/api/clock", { date: addDays(CLOCK_START, v) });
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-64 items-center gap-3">
          <CalendarDays className="size-5 text-primary" />
          <div>
            <div className="text-lg font-semibold">
              {new Date(`${shown}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
            </div>
            <div className="text-xs text-muted-foreground">
              {toDiwali > 0 ? `Diwali in ${toDiwali} days` : toDiwali === 0 ? "Diwali today" : `${-toDiwali} days after Diwali`}
              {saving && <Loader2 className="ml-1 inline size-3 animate-spin" />}
            </div>
          </div>
        </div>
        <div className="flex-1 px-2">
          <Slider
            min={0}
            max={total}
            step={1}
            value={[value]}
            onValueChange={(v) => {
              dragging.current = true;
              setValue(v[0] ?? 0);
            }}
            onValueCommit={(v) => commit(v[0] ?? 0)}
            aria-label="Demo date"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>1 Oct</span>
            <span>Demo clock · drag to replay the season</span>
            <span>20 Nov</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <FlagChip on={data.flags.festiveMode} label="festive_mode" />
          <FlagChip on={data.flags.surgeMode} label="surge_mode" tone="destructive" />
          <FlagChip on={data.flags.outboundCallsEnabled} label="calls enabled" />
          <Badge variant="flagsmith"><Flag />{data.flags.source === "flagsmith" ? "live from Flagsmith" : "Flagsmith not connected"}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function FlagChip({ on, label, tone }: { on: boolean; label: string; tone?: "destructive" }) {
  return (
    <Badge variant={on ? (tone === "destructive" ? "destructive" : "success") : "outline"} className="font-mono transition-colors">
      <span className={cn("size-1.5 rounded-full", on ? "bg-current" : "bg-muted-foreground/50")} />
      {label} {on ? "ON" : "OFF"}
    </Badge>
  );
}

/* ───────────── Blood groups ───────────── */

function GroupGrid({ data }: { data: OverviewData }) {
  return (
    <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
      {data.groups.map((g) => (
        <div
          key={g.group}
          className={cn(
            "rounded-xl border bg-card p-3 transition-colors",
            g.status === "short" && "border-destructive/50 bg-destructive/5",
            g.status === "watch" && "border-warning/60 bg-warning/5",
            g.group === data.focus.group && "ring-2 ring-primary/40",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">{g.group}</span>
            <span className={cn("size-2 rounded-full", g.status === "short" ? "bg-destructive pulse-ring" : g.status === "watch" ? "bg-warning" : "bg-success")} />
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{Math.round(g.startStock)}</div>
          <div className="text-[11px] text-muted-foreground">
            {g.shortageDate ? <span className="text-destructive">short {shortDate(g.shortageDate)}</span> : g.status === "watch" ? "watch" : "ok"}
          </div>
        </div>
      ))}
    </div>
  );
}

function WhyBox({ data }: { data: OverviewData }) {
  if (data.reasons.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-dashed p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Why</div>
      <ul className="grid gap-1 text-sm md:grid-cols-2">
        {data.reasons.map((r) => (
          <li key={r} className="flex gap-2"><span className="text-primary">•</span>{r}</li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────── The gap and the campaign ───────────── */

function GapCard({ data, onChange }: { data: OverviewData; onChange: () => void }) {
  const f = data.focus;
  const c = data.campaign;
  const [busy, setBusy] = useState<string | null>(null);
  const [autoFill, setAutoFill] = useState(false);
  const target = c?.gapUnits ?? f.gapUnits;
  const covered = Math.min(target, f.expectedFromBookings);
  const pct = target > 0 ? (covered / target) * 100 : 0;
  const perBooking = data.yield.showUp * data.yield.passScreening;

  // "Sped up": keep booking test donors until the gap closes.
  useEffect(() => {
    if (!autoFill || !c || c.status !== "active") return;
    const t = setInterval(async () => {
      try {
        const r = await post(`/api/campaigns/${c.id}/simulate?count=3`);
        onChange();
        if (r.booked === 0) setAutoFill(false);
      } catch {
        setAutoFill(false);
      }
    }, 1200);
    return () => clearInterval(t);
  }, [autoFill, c, onChange]);
  useEffect(() => {
    if (c?.status === "completed") setAutoFill(false);
  }, [c?.status]);

  async function act(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className={cn(f.status === "short" && !c && "border-destructive/40")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Siren className="size-4 text-primary" />{f.group} gap</CardTitle>
        <CardDescription>Counted in expected units, not bookings: each booking ≈ {perBooking.toFixed(2)} units ({Math.round(data.yield.showUp * 100)}% show up × {Math.round(data.yield.passScreening * 100)}% pass screening).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {f.status !== "short" && !c ? (
          <div className="rounded-lg bg-success/10 p-4 text-sm text-success">
            <CheckCircle2 className="mb-1 size-5" />
            No shortage projected in the next {f.days.length} days.
            {!data.flags.festiveMode && <div className="mt-1 text-muted-foreground">Festive mode is off for this bank and date.</div>}
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-5xl font-semibold tabular-nums text-primary">{Math.max(0, Math.ceil(target - covered))}</div>
                  <div className="text-sm text-muted-foreground">units still needed of {target}</div>
                </div>
                {f.shortageDate && (
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">below safe on</div>
                    <div className="font-semibold">{shortDate(f.shortageDate)}</div>
                  </div>
                )}
              </div>
              <Progress value={pct} className="mt-3 h-3" indicatorClassName="bg-success" />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{f.bookedCount} booked → {f.expectedFromBookings.toFixed(1)} expected units</span>
                <span>target ~{c?.bookingsTarget ?? f.bookingsNeeded} bookings</span>
              </div>
            </div>

            {!c && (
              <Button className="w-full" size="lg" disabled={busy !== null} onClick={() => act("raise", () => post("/api/campaigns", { group: f.group }), "Sent to the medical officer via NudgeBee")}>
                {busy === "raise" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}Send plan to medical officer
              </Button>
            )}

            {c?.status === "pending_approval" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-nudgebee/40 bg-nudgebee/5 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-nudgebee"><Loader2 className="size-4 animate-spin" />Waiting for approval in NudgeBee</div>
                  <p className="mt-1 text-muted-foreground">Call {c.bloodGroup} donors {shortDate(c.windowStart)}–{shortDate(c.windowEnd)}, before they travel. Calls start when surge_mode turns ON in Flagsmith.</p>
                </div>
                <Button variant="outline" className="w-full" disabled={busy !== null} onClick={() => act("approve", () => post(`/api/campaigns/${c.id}/approve`), "Approved: surge_mode ON")}>
                  {busy === "approve" && <Loader2 className="animate-spin" />}Approve here instead (fallback)
                </Button>
              </div>
            )}

            {c?.status === "active" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-sarvam/40 bg-sarvam/5 p-3 text-sm">
                  <span className="flex items-center gap-2 font-medium text-sarvam"><PhoneCall className="size-4" />Calling donors</span>
                  <span className="text-muted-foreground">{data.activeCalls}/{data.flags.maxConcurrentCalls} lines · {data.queued} queued</span>
                </div>
                <Button variant="secondary" className="w-full" onClick={() => setAutoFill((v) => !v)}>
                  {autoFill ? <Loader2 className="animate-spin" /> : <Play />}
                  {autoFill ? "Test donors answering…" : "Speed up: test donors answer"}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">Sped-up bookings come from synthetic test donors.</p>
              </div>
            )}

            {c?.status === "completed" && (
              <div className="rounded-lg bg-success/10 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="size-5" />Gap covered · calling stopped</div>
                <p className="mt-1 text-muted-foreground">Approved by {c.approvedBy ?? "medical officer"}. Units arrive before Diwali.</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────── Calls ───────────── */

function CallsCard({ data }: { data: OverviewData }) {
  const real = data.calls.filter((c) => !c.simulated);
  const sim = data.calls.filter((c) => c.simulated);
  const live = real[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PhoneCall className="size-4 text-sarvam" />Calls</CardTitle>
        <CardDescription>Sarvam voice agent, in each donor&apos;s language.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data.campaign || data.campaign.status === "pending_approval" ? (
          <p className="text-sm text-muted-foreground">No calls until the medical officer approves.</p>
        ) : (
          <>
            {live && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{live.donorName} · {live.donorRef}</span>
                  <CallStatus status={live.status} outcome={live.outcome} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Language: {live.language} · last donated {live.lastDonationOn ? shortDate(live.lastDonationOn) : "—"}</div>
                {live.transcript && live.transcript.length > 0 && (
                  <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-sm">
                    {live.transcript.map((m, i) => (
                      <div key={i} className={cn("rounded-md px-2 py-1", m.role === "agent" ? "bg-sarvam/10" : "bg-muted")}>
                        <span className="mr-1 text-[10px] font-semibold uppercase text-muted-foreground">{m.role === "agent" ? "Agent" : "Donor"}</span>
                        {m.text}
                      </div>
                    ))}
                  </div>
                )}
                {live.healthAnswers && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(live.healthAnswers).map(([k, v]) => (
                      <Badge key={k} variant={v === "no" ? "success" : "warning"}>{k}: {v}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            {sim.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Test donors (simulated)</div>
                {sim.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.donorRef}</span>
                    <CallStatus status={c.status} outcome={c.outcome} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CallStatus({ status, outcome }: { status: string; outcome: string | null }) {
  if (outcome === "booked") return <Badge variant="success">booked</Badge>;
  if (outcome) return <Badge variant="secondary">{outcome.replace("_", " ")}</Badge>;
  if (status === "in_progress" || status === "dialing") return <Badge variant="sarvam"><span className="size-1.5 animate-pulse rounded-full bg-current" />{status === "dialing" ? "dialing" : "on call"}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

/* ───────────── Flagsmith control room ───────────── */

function FlagsCard({ data }: { data: OverviewData }) {
  const fl = data.flags;
  const rows: [string, string, boolean | null][] = [
    ["festive_mode", fl.festiveMode ? `ON (segment: festive season, ${data.bank.state})` : "OFF", fl.festiveMode],
    ["surge_mode", fl.surgeMode ? "ON" : "OFF", fl.surgeMode],
    ["outbound_calls_enabled", fl.outboundCallsEnabled ? "ON" : "OFF (kill switch)", fl.outboundCallsEnabled],
    ["max_concurrent_calls", String(fl.maxConcurrentCalls), null],
    ["health_questions", `${fl.healthQuestions.version} · ${fl.healthQuestions.questions.length} questions`, null],
    ["forecast_config", `safe ${fl.forecastConfig.safeStockDays}d · yield ${(fl.forecastConfig.yield.showUp * fl.forecastConfig.yield.passScreening).toFixed(2)}`, null],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Flag className="size-4 text-flagsmith" />Flagsmith control room</CardTitle>
        <CardDescription>Every rule changes live, with no redeploy.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(([k, v, on]) => (
          <div key={k} className="flex items-center justify-between gap-2 text-sm">
            <code className="text-xs">{k}</code>
            <span className={cn("text-right text-xs", on === true && "font-medium text-success", on === false && "text-muted-foreground")}>{v}</span>
          </div>
        ))}
        <Separator className="my-2" />
        <div className="text-xs text-muted-foreground">Health questions on every call:</div>
        <ol className="list-decimal space-y-0.5 pl-4 text-xs">
          {fl.healthQuestions.questions.map((q) => <li key={q.id}>{q.question}</li>)}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ───────────── Activity ───────────── */

function actorVariant(actor: string, kind: string): "flagsmith" | "nudgebee" | "sarvam" | "secondary" {
  const a = actor.toLowerCase();
  if (kind === "flag" || a.includes("flagsmith")) return "flagsmith";
  if (kind === "nudgebee" || a.includes("nudgebee")) return "nudgebee";
  if (kind === "call" || a.includes("sarvam")) return "sarvam";
  return "secondary";
}

function ActivityCard({ data }: { data: OverviewData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="size-4" />Activity</CardTitle>
        <CardDescription>Who did what, in order.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {data.events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm animate-in fade-in slide-in-from-top-1">
              <span className="w-12 shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">{istTime(e.createdAt)}</span>
              <div className="min-w-0">
                <Badge variant={actorVariant(e.actor, e.kind)} className="mb-1">{e.actor}</Badge>
                <div className="break-words">{e.message}</div>
              </div>
            </li>
          ))}
          {data.events.length === 0 && (
            <li className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4" />Nothing yet.</li>
          )}
        </ul>
        <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="size-3" />Synthetic donors are never dialled.</div>
      </CardContent>
    </Card>
  );
}
