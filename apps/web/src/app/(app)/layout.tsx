import { requireMember } from "@/server/session";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  return (
    <AppShell user={{ name: member.name, role: member.role }} bank={{ name: member.bank.name, city: member.bank.city, state: member.bank.state, isDemo: member.bank.isDemo }}>
      {children}
    </AppShell>
  );
}
