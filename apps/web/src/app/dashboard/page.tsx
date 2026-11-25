import { requireMember } from "@/server/session";
import { Dashboard } from "@/components/dashboard/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const member = await requireMember();
  return <Dashboard userName={member.name} role={member.role} />;
}
