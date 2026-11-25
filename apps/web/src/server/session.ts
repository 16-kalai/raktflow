import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { banks, getDb, memberships } from "@raktflow/db";
import { getAuth } from "./auth";

export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

export type Member = Awaited<ReturnType<typeof requireMember>>;

/** The signed-in user and the bank they work at. Redirects to /login otherwise. */
export async function requireMember() {
  const session = await getSession();
  if (!session) redirect("/login");
  return memberFor(session.user.id, session.user.name);
}

/** Same as requireMember, for API routes: returns null instead of redirecting. */
export async function apiMember() {
  const session = await getSession();
  if (!session) return null;
  return memberFor(session.user.id, session.user.name);
}

async function memberFor(userId: string, name: string) {
  const db = getDb();
  const [row] = await db
    .select({ bank: banks, role: memberships.role })
    .from(memberships)
    .innerJoin(banks, eq(banks.id, memberships.bankId))
    .where(and(eq(memberships.userId, userId)))
    .limit(1);
  if (!row) throw new Error("No blood bank membership for this user");
  return { userId, name, role: row.role, bank: row.bank };
}
