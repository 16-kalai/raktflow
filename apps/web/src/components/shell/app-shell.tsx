"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, HeartPulse, LayoutDashboard, LogOut, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: HeartPulse },
  { href: "/donors", label: "Donors", icon: Users },
];

const SPONSORS = [
  { name: "Flagsmith", role: "Control room", color: "bg-flagsmith" },
  { name: "NudgeBee", role: "Approvals & ops", color: "bg-nudgebee" },
  { name: "Sarvam AI", role: "Voice calls", color: "bg-sarvam" },
];

export function AppShell({
  children,
  user,
  bank,
}: {
  children: React.ReactNode;
  user: { name: string; role: string };
  bank: { name: string; city: string; state: string; isDemo: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function resetDemo() {
    const res = await fetch("/api/demo/reset", { method: "POST" });
    if (res.ok) {
      toast.success("Demo reset to 20 Oct 2026");
      router.refresh();
      window.dispatchEvent(new Event("raktflow:refresh"));
    } else toast.error("Reset failed");
  }

  return (
    <div className="flex min-h-dvh bg-[radial-gradient(ellipse_at_top_left,oklch(0.97_0.02_25),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.97_0.015_300),transparent_50%)] bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-card/70 px-4 py-5 backdrop-blur md:flex">
        <Link href="/dashboard" className="px-2">
          <Logo />
        </Link>
        <div className="mt-6 rounded-xl border bg-background/60 p-3">
          <div className="text-sm font-semibold">{bank.name}</div>
          <div className="text-xs text-muted-foreground">
            {bank.city}, {bank.state}
          </div>
          {bank.isDemo && <div className="mt-2 inline-flex rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">demo data</div>}
        </div>
        <nav className="mt-6 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 px-1">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Activity className="size-3" /> Powered by
          </div>
          <ul className="space-y-2">
            {SPONSORS.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-xs">
                <span className={cn("size-2 rounded-full", s.color)} />
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">· {s.role}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-auto space-y-2">
          {bank.isDemo && (
            <button onClick={resetDemo} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
              <RotateCcw className="size-3.5" /> Reset demo to 20 Oct
            </button>
          )}
          <div className="flex items-center justify-between rounded-xl border bg-background/60 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="text-xs capitalize text-muted-foreground">{user.role.replace("_", " ")}</div>
            </div>
            <button
              aria-label="Log out"
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={async () => {
                await authClient.signOut();
                router.replace("/login");
              }}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card/70 px-4 py-3 backdrop-blur md:hidden">
          <Logo />
          <nav className="flex gap-1">
            {NAV.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} aria-label={label} className={cn("rounded-md p-2", pathname.startsWith(href) ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                <Icon className="size-4" />
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
