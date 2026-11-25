import { NextResponse } from "next/server";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { BLOOD_GROUPS, checkEligibility, isBloodGroup, type BloodGroup } from "@raktflow/core";
import { donors, getDb } from "@raktflow/db";
import { bankToday } from "@raktflow/domain";
import { apiMember } from "@/server/session";

export const dynamic = "force-dynamic";

const PAGE = 25;

/** Donor registry: search, filter by group, eligibility on the bank's current date. */
export async function GET(req: Request) {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const group = url.searchParams.get("group") ?? "";
  const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
  const db = getDb();
  const filters = [eq(donors.bankId, member.bank.id)];
  if (group && isBloodGroup(group)) filters.push(eq(donors.bloodGroup, group));
  if (q) filters.push(or(ilike(donors.name, `%${q}%`), ilike(donors.ref, `%${q}%`), ilike(donors.city, `%${q}%`))!);
  const where = and(...filters);
  const [rows, [count], byGroup] = await Promise.all([
    db.select().from(donors).where(where).orderBy(sql`${donors.isDemoContact} desc`, asc(donors.name)).limit(PAGE).offset(page * PAGE),
    db.select({ n: sql<number>`count(*)::int` }).from(donors).where(where),
    db
      .select({ group: donors.bloodGroup, n: sql<number>`count(*)::int` })
      .from(donors)
      .where(eq(donors.bankId, member.bank.id))
      .groupBy(donors.bloodGroup),
  ]);
  const today = bankToday(member.bank);
  return NextResponse.json({
    total: count?.n ?? 0,
    page,
    pageSize: PAGE,
    byGroup: BLOOD_GROUPS.map((g) => ({ group: g, n: byGroup.find((b) => b.group === g)?.n ?? 0 })),
    donors: rows.map((d) => {
      const e = checkEligibility(
        {
          bloodGroup: d.bloodGroup as BloodGroup,
          sex: d.sex,
          lastDonationOn: d.lastDonationOn,
          consentAt: d.consentAt,
          optedOutAt: d.optedOutAt,
          deferredUntil: d.deferredUntil,
          dndCheckedAt: d.dndCheckedAt,
        },
        d.bloodGroup as BloodGroup,
        today,
      );
      return {
        id: d.id,
        ref: d.ref,
        name: d.name,
        phone: maskPhone(d.phone),
        bloodGroup: d.bloodGroup,
        sex: d.sex,
        language: d.language,
        city: d.city,
        lastDonationOn: d.lastDonationOn,
        consent: Boolean(d.consentAt),
        optedOut: Boolean(d.optedOutAt),
        isDemoContact: d.isDemoContact,
        eligible: e.eligible,
        reasons: e.reasons,
        eligibleFrom: e.eligibleFrom,
      };
    }),
  });
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6 || /^9100000/.test(digits)) return "synthetic";
  return `+${digits.slice(0, 2)} ••••• ${digits.slice(-4)}`;
}
