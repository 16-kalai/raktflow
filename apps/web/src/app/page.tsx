import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Flag,
  PhoneCall,
  Play,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

const PROOF = [
  { value: "35–40", unit: "surgeries / day", text: "at Tata Memorial; nearly half at risk six days after Diwali", source: "Hindustan Times · 15 Nov 2026" },
  { value: "10 / 15", unit: "blood banks", text: "in Nagpur with zero whole blood since Diwali began", source: "The Hitavada · 14 Nov 2026" },
  { value: "3", unit: "days of blood", text: "left for the whole of West Bengal after the Pujas", source: "Millennium Post · 19 Nov 2026" },
];

const STEPS = [
  { icon: CalendarClock, title: "Sees it three weeks early", text: "Bank stock, public e-RaktKosh data, patients' scheduled transfusions and the festival calendar, projected day by day.", tag: "RaktFlow" },
  { icon: ShieldCheck, title: "Doctor approves", text: "NudgeBee summarises the shortage with AI and routes it to the medical officer. One approval switches surge mode on.", tag: "NudgeBee" },
  { icon: PhoneCall, title: "Donors called before they travel", text: "Sarvam's voice agent calls in the donor's language, runs the health pre-check and books a slot during the call.", tag: "Sarvam AI" },
  { icon: BellRing, title: "Stops when it's enough", text: "Counts expected units, not bookings. When the gap is covered, calling stops and surge mode switches off.", tag: "Flagsmith" },
];

const SPONSORS = [
  {
    icon: Flag,
    name: "Flagsmith",
    role: "The control room",
    color: "text-flagsmith",
    ring: "ring-flagsmith/30",
    points: ["Festive mode switches on per state by date segments", "Each donor's language via identities", "Health questions change only after doctor approval", "Kill switch + global call limit, audited"],
  },
  {
    icon: Workflow,
    name: "NudgeBee",
    role: "Approvals and operations",
    color: "text-nudgebee",
    ring: "ring-nudgebee/30",
    points: ["AI summary of the shortage for the doctor", "Human approval before any call", "Writes surge mode to Flagsmith", "Reads Kubernetes worker logs, lowers call limits"],
  },
  {
    icon: PhoneCall,
    name: "Sarvam AI",
    role: "The voice",
    color: "text-sarvam",
    ring: "ring-sarvam/30",
    points: ["Real outbound calls in Indian languages", "Live slot lookup and booking mid-call", "AI + recording disclosure, say “stop” to opt out", "Transcript and outcome back to RaktFlow"],
  },
];

export default async function Home() {
  const session = await getSession().catch(() => null);
  const primaryHref = session ? "/dashboard" : "/demo";
  const primaryLabel = session ? "Open dashboard" : "View live demo";

  return (
    <div className="min-h-dvh bg-background">
      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden bg-[oklch(0.17_0.03_20)] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,oklch(0.45_0.18_25/0.55),transparent_45%),radial-gradient(circle_at_85%_10%,oklch(0.75_0.15_70/0.25),transparent_35%),radial-gradient(circle_at_70%_90%,oklch(0.45_0.15_300/0.35),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <header className="flex items-center justify-between py-6">
            <Logo className="text-white" />
            <div className="flex items-center gap-2">
              {!session && (
                <Button variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
              )}
              <Button className="bg-white text-[oklch(0.3_0.1_25)] hover:bg-white/90" asChild>
                <a href={primaryHref}>{primaryLabel}</a>
              </Button>
            </div>
          </header>

          <div className="grid items-center gap-12 pt-10 pb-20 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16 lg:pb-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">
                <Sparkles className="size-3.5 text-[oklch(0.85_0.13_70)]" />
                Festive Hacks 2026 · Flagsmith · NudgeBee · Sarvam AI
              </div>
              <h1 className="mt-6 text-5xl leading-[1.05] font-semibold tracking-tight md:text-7xl">
                Blood before the festival,{" "}
                <span className="bg-gradient-to-r from-[oklch(0.75_0.17_30)] to-[oklch(0.85_0.14_70)] bg-clip-text text-transparent">not after.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/75">
                Every Diwali, donation camps stop and donors travel home. RaktFlow warns blood banks three weeks before the shortage,
                gets a doctor's approval, and calls donors in their language before they leave the city.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="h-12 bg-[oklch(0.6_0.21_25)] px-6 text-base text-white shadow-lg shadow-[oklch(0.6_0.21_25/0.35)] hover:bg-[oklch(0.55_0.21_25)]" asChild>
                  <a href={primaryHref}>
                    <Play className="fill-current" /> {primaryLabel} <ArrowRight />
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="h-12 border-white/25 bg-white/5 px-6 text-base text-white hover:bg-white/10 hover:text-white" asChild>
                  <a href="https://github.com/16-kalai/raktflow" target="_blank" rel="noreferrer">
                    View the code
                  </a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-white/50">No sign-up needed. Demo bank with illustrative patients and synthetic donors.</p>
            </div>

            {/* Product preview */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[oklch(0.6_0.2_25/0.4)] to-[oklch(0.5_0.15_300/0.3)] blur-2xl" />
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">Sahyog Blood Centre · Oct 20</div>
                  <span className="rounded-full bg-[oklch(0.6_0.21_25/0.25)] px-2 py-0.5 text-[11px] text-[oklch(0.85_0.1_25)]">shortage ahead</span>
                </div>
                <div className="mt-3 text-2xl font-semibold">O+ runs short on 11 Nov</div>
                <svg viewBox="0 0 300 110" className="mt-4 w-full">
                  <defs>
                    <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="white" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect x="120" y="0" width="140" height="110" fill="oklch(0.8 0.15 70 / 0.12)" />
                  <text x="190" y="12" fill="white" fillOpacity="0.6" fontSize="8" textAnchor="middle">Diwali travel</text>
                  <line x1="0" x2="300" y1="78" y2="78" stroke="oklch(0.7 0.2 25)" strokeDasharray="4 3" />
                  <path d="M0 20 C 60 22, 100 30, 140 48 S 220 95, 300 98 L300 110 L0 110 Z" fill="url(#g)" />
                  <path d="M0 20 C 60 22, 100 30, 140 48 S 220 95, 300 98" fill="none" stroke="white" strokeOpacity="0.8" strokeWidth="2" />
                  <path d="M0 20 C 60 22, 100 26, 140 32 S 220 52, 300 58" fill="none" stroke="oklch(0.75 0.17 155)" strokeWidth="2.5" />
                  <circle cx="214" cy="78" r="4" fill="oklch(0.65 0.22 25)" stroke="white" strokeWidth="1.5" />
                </svg>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["25", "units short"],
                    ["41", "bookings needed"],
                    ["3 wks", "warning"],
                  ].map(([v, l]) => (
                    <div key={l} className="rounded-lg bg-white/5 px-2 py-2 ring-1 ring-white/10">
                      <div className="text-lg font-semibold">{v}</div>
                      <div className="text-[10px] text-white/60">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                    <span className="size-2 rounded-full bg-nudgebee" /> Medical officer approved in NudgeBee
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                    <span className="size-2 rounded-full bg-sarvam" /> Ravi booked for 2 Nov, 5 PM — on a real call
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-[oklch(0.75_0.17_155/0.15)] px-3 py-2 text-[oklch(0.88_0.1_155)]">
                    <CheckCircle2 className="size-4" /> Gap covered before Diwali · calling stopped
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Proof ───────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">This festive season</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">The shortage comes with the same festivals, every year.</h2>
          <p className="mt-3 text-muted-foreground">India doesn't run out of donors. It runs out of donors in the right city, in the right week.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PROOF.map((p) => (
            <div key={p.source} className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-primary to-[oklch(0.75_0.16_60)]" />
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-tight text-primary">{p.value}</span>
                <span className="text-sm text-muted-foreground">{p.unit}</span>
              </div>
              <p className="mt-3 text-sm">{p.text}</p>
              <p className="mt-4 text-xs text-muted-foreground">{p.source}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How RaktFlow moves the blood drive first</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text, tag }, i) => (
              <div key={title} className="relative rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-4xl font-semibold text-muted-foreground/20">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
                <div className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Sponsors ───────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Three sponsors, one loop</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">Every decision is a flag, every flag change is approved or audited, and every call is real.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {SPONSORS.map(({ icon: Icon, name, role, color, ring, points }) => (
            <div key={name} className={`rounded-2xl border bg-card p-6 shadow-sm ring-1 ${ring}`}>
              <div className="flex items-center gap-3">
                <Icon className={`size-6 ${color}`} />
                <div>
                  <div className="font-semibold">{name}</div>
                  <div className="text-xs text-muted-foreground">{role}</div>
                </div>
              </div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {points.map((pt) => (
                  <li key={pt} className="flex gap-2">
                    <CheckCircle2 className={`mt-0.5 size-4 shrink-0 ${color}`} />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[oklch(0.35_0.13_25)] to-[oklch(0.5_0.19_30)] px-8 py-14 text-center text-white">
          <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]" />
          <h2 className="relative text-3xl font-semibold md:text-5xl">We can't move Diwali.</h2>
          <p className="relative mt-3 text-lg text-white/80">But we can move the blood drive.</p>
          <Button size="lg" className="relative mt-8 h-12 bg-white px-6 text-base text-[oklch(0.3_0.1_25)] hover:bg-white/90" asChild>
            <a href={primaryHref}>
              {primaryLabel} <ArrowRight />
            </a>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-muted-foreground md:flex-row md:justify-between">
          <span>RaktFlow · Built at Festive Hacks, Bengaluru, 25 Nov 2026</span>
          <span>Demo bank (Sahyog Blood Centre, Pune) is fictional. Patients are illustrative; donors are synthetic except one consenting demo contact.</span>
        </div>
      </footer>
    </div>
  );
}
