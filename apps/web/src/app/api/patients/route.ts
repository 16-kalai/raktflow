import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { BLOOD_GROUPS } from "@raktflow/core";
import { getDb, transfusions } from "@raktflow/db";
import { logEvent } from "@raktflow/domain";
import { apiMember } from "@/server/session";

export const dynamic = "force-dynamic";

/** Patients with planned transfusions. Their dates are pinned on the forecast. */
export async function GET() {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await getDb().select().from(transfusions).where(eq(transfusions.bankId, member.bank.id)).orderBy(asc(transfusions.date));
  return NextResponse.json({ patients: rows });
}

const patientSchema = z.object({
  patientName: z.string().trim().min(1).max(80),
  age: z.coerce.number().int().min(0).max(120).optional(),
  condition: z.string().trim().min(1).max(120),
  hospital: z.string().trim().max(120).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  units: z.coerce.number().int().min(1).max(20),
  everyDays: z.coerce.number().int().min(1).max(365).optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function POST(req: Request) {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = patientSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid patient" }, { status: 400 });
  const p = parsed.data;
  const db = getDb();
  const [row] = await db
    .insert(transfusions)
    .values({
      bankId: member.bank.id,
      label: `${p.patientName}${p.age ? `, ${p.age}` : ""} · ${p.condition}`,
      patientName: p.patientName,
      age: p.age ?? null,
      condition: p.condition,
      hospital: p.hospital || null,
      bloodGroup: p.bloodGroup,
      date: p.date,
      units: p.units,
      everyDays: p.everyDays ?? null,
      notes: p.notes || null,
    })
    .returning();
  await logEvent(db, member.bank.id, "system", member.name, `Patient added: ${p.patientName} needs ${p.units} ${p.bloodGroup} on ${p.date}`);
  return NextResponse.json({ patient: row });
}
