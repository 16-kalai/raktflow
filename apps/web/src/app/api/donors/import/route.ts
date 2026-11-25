import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { BLOOD_GROUPS } from "@raktflow/core";
import { donors, getDb } from "@raktflow/db";
import { logEvent } from "@raktflow/domain";
import { apiMember } from "@/server/session";

/**
 * CSV import of a bank's donor registry. Validates every row, normalises
 * Indian mobile numbers to E.164, skips duplicates (by phone, within the
 * bank) and only marks consent when the file says so. Rows are inserted in
 * batches so a 100k-donor file doesn't become one giant statement.
 */
const MAX_ROWS = 50_000;

const rowSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(80),
  phone: z.string().trim().min(1, "phone is required"),
  blood_group: z
    .string()
    .trim()
    .transform((g) => g.toUpperCase().replace(/\s+/g, "").replace("VE", "").replace("POS", "+").replace("NEG", "-"))
    .pipe(z.enum(BLOOD_GROUPS, { message: "blood_group must be one of A+, A-, B+, B-, AB+, AB-, O+, O-" })),
  sex: z
    .string()
    .trim()
    .toLowerCase()
    .transform((s) => (s.startsWith("f") ? "female" : s.startsWith("m") ? "male" : s))
    .pipe(z.enum(["male", "female"], { message: "sex must be male or female" })),
  last_donation_on: z
    .string()
    .trim()
    .optional()
    .transform((d) => (d ? d : null))
    .refine((d) => d === null || /^\d{4}-\d{2}-\d{2}$/.test(d), "last_donation_on must be YYYY-MM-DD"),
  language: z.string().trim().toLowerCase().optional().transform((l) => (l ? l.slice(0, 2) : "en")),
  city: z.string().trim().optional().transform((c) => c || "Unknown"),
  consent: z.string().trim().toLowerCase().optional().transform((c) => c === "yes" || c === "y" || c === "true" || c === "1"),
});

function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export async function POST(req: Request) {
  const member = await apiMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const text = await req.text();
  if (text.length > 15_000_000) return NextResponse.json({ error: "File too large (max ~15 MB)" }, { status: 413 });
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length < 2) return NextResponse.json({ error: "The file needs a header row and at least one donor" }, { status: 400 });
  const header = rows[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const missing = ["name", "phone", "blood_group", "sex"].filter((h) => !header.includes(h));
  if (missing.length) return NextResponse.json({ error: `Missing columns: ${missing.join(", ")}` }, { status: 400 });
  if (rows.length - 1 > MAX_ROWS) return NextResponse.json({ error: `Max ${MAX_ROWS} rows per upload` }, { status: 400 });

  const db = getDb();
  const existing = new Set(
    (await db.select({ phone: donors.phone }).from(donors).where(eq(donors.bankId, member.bank.id))).map((d) => d.phone),
  );
  const errors: { line: number; message: string }[] = [];
  const now = new Date();
  const toInsert: (typeof donors.$inferInsert)[] = [];
  let duplicates = 0;

  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const record = Object.fromEntries(header.map((h, j) => [h, cells[j] ?? ""]));
    const parsed = rowSchema.safeParse(record);
    if (!parsed.success) {
      errors.push({ line, message: parsed.error.issues[0]?.message ?? "invalid row" });
      return;
    }
    const phone = normalisePhone(parsed.data.phone);
    if (!phone) {
      errors.push({ line, message: "phone must be a 10-digit Indian mobile or +country number" });
      return;
    }
    if (existing.has(phone)) {
      duplicates++;
      return;
    }
    existing.add(phone);
    toInsert.push({
      bankId: member.bank.id,
      ref: `donor_${randomBytes(3).toString("hex")}`,
      name: parsed.data.name,
      phone,
      bloodGroup: parsed.data.blood_group,
      sex: parsed.data.sex,
      language: parsed.data.language,
      city: parsed.data.city,
      lastDonationOn: parsed.data.last_donation_on,
      consentAt: parsed.data.consent ? now : null,
      // DND must be checked against the TRAI registry before dialling; imports start unchecked.
      dndCheckedAt: null,
    });
  });

  for (let i = 0; i < toInsert.length; i += 500) {
    await db.insert(donors).values(toInsert.slice(i, i + 500)).onConflictDoNothing();
  }
  if (toInsert.length) {
    await logEvent(db, member.bank.id, "system", member.name, `Imported ${toInsert.length} donors from CSV (${duplicates} duplicates skipped, ${errors.length} rows with errors)`);
  }
  return NextResponse.json({ imported: toInsert.length, duplicates, errors: errors.slice(0, 50), errorCount: errors.length });
}
