import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BellRing, CalendarClock, PhoneCall, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { getSession } from "@/server/session";

const FACTS = [
  { value: "35–40", label: "cancer surgeries a day at Tata Memorial; nearly half at risk", source: "Hindustan Times, Nov 15 2026" },
  { value: "10 of 15", label: "Nagpur blood banks with zero whole blood since Diwali began", source: "The Hitavada, Nov 14 2026" },
  { value: "3 days", label: "of blood left for all of West Bengal after the Pujas", source: "Millennium Post, Nov 19 2026" },
];

const STEPS = [
  { icon: CalendarClock, title: "See it three weeks early", text: "Stock, public e-RaktKosh data and the festival calendar, projected day by day." },
  { icon: ShieldCheck, title: "Doctor approves", text: "NudgeBee routes the plan to the medical officer, then switches surge mode on in Flagsmith." },
  { icon: PhoneCall, title: "Donors called before they travel", text: "Sarvam calls in the donor's language and books a slot during the call." },
  { icon: BellRing, title: "Stops when the gap is covered", text: "Counts expected units, not bookings, and stops calling when it's enough." },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession().catch(() => null);
  if (session) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-6xl px-6">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link href="/login">Log in</Link></Button>
          <Button asChild><Link href="/signup">Get started</Link></Button>
        </div>
      </header>

      <section className="py-16 md:py-24">
        <Badge variant="outline" className="mb-6">Festive Hacks 2026 · Flagsmith · NudgeBee · Sarvam AI</Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Blood before the festival, <span className="text-primary">not after.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Every Diwali, donation camps stop and donors travel home. RaktFlow warns blood bank coordinators three weeks
          before the shortage and calls donors before they leave.
        </p>
        <div className="mt-8 flex gap-3">
          <Button size="lg" asChild><Link href="/signup">Open the coordinator dashboard <ArrowRight /></Link></Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FACTS.map((f) => (
          <div key={f.value} className="rounded-xl border bg-card p-6">
            <div className="text-4xl font-semibold text-primary">{f.value}</div>
            <p className="mt-2 text-sm">{f.label}</p>
            <p className="mt-3 text-xs text-muted-foreground">{f.source}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 py-16 md:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border p-5">
            <Icon className="size-5 text-primary" />
            <h3 className="mt-3 font-medium">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
      <footer className="border-t py-6 text-xs text-muted-foreground">
        Demo uses a fictional bank (Sahyog Blood Centre, Pune) and synthetic donors.
      </footer>
    </main>
  );
}
