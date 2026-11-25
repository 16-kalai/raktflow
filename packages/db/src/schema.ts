import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ───────────────────────── Auth (Better Auth) ───────────────────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────────────────────── Tenancy ───────────────────────── */

export const banks = pgTable("banks", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  /** Two-letter state code, e.g. MH, WB. Drives Flagsmith festival segments. */
  state: text("state").notNull(),
  /** Demo clock. Null means "use today's date in India". */
  demoDate: date("demo_date"),
  /** Date the stock lots were counted. Forecasts simulate forward from here. */
  stockAsOf: date("stock_as_of").notNull(),
  usagePerDay: jsonb("usage_per_day").$type<Record<string, number>>().notNull(),
  groupMix: jsonb("group_mix").$type<Record<string, number>>().notNull(),
  walkInPerDay: real("walk_in_per_day").notNull(),
  isDemo: boolean("is_demo").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const memberRole = pgEnum("member_role", ["coordinator", "medical_officer", "admin"]);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("coordinator"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("membership_user_bank_uq").on(t.userId, t.bankId)],
);

/* ───────────────────────── Inventory & planning ───────────────────────── */

export const stockLots = pgTable(
  "stock_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    bloodGroup: text("blood_group").notNull(),
    component: text("component").notNull().default("PRBC"),
    units: integer("units").notNull(),
    expiresOn: date("expires_on").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("stock_bank_group_idx").on(t.bankId, t.bloodGroup, t.expiresOn)],
);

export const campStatus = pgEnum("camp_status", ["planned", "cancelled"]);

export const camps = pgTable(
  "camps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    date: date("date").notNull(),
    expectedUnits: integer("expected_units").notNull(),
    status: campStatus("status").notNull().default("planned"),
    cancelReason: text("cancel_reason"),
    createdAt: createdAt(),
  },
  (t) => [index("camps_bank_date_idx").on(t.bankId, t.date)],
);

export const festivalWindows = pgTable(
  "festival_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    state: text("state").notNull(),
    name: text("name").notNull(),
    start: date("start").notNull(),
    end: date("end").notNull(),
    /** Fallback only. The live value comes from Flagsmith `forecast_config`. */
    collectionFactor: real("collection_factor").notNull(),
    demandFactor: real("demand_factor").notNull().default(1),
  },
  (t) => [index("festival_state_idx").on(t.state, t.start)],
);

export const transfusions = pgTable(
  "scheduled_transfusions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    patientName: text("patient_name"),
    age: integer("age"),
    condition: text("condition"),
    hospital: text("hospital"),
    /** Days between transfusions (e.g. 21 for thalassemia every 3 weeks). Null = one-off. */
    everyDays: integer("every_days"),
    notes: text("notes"),
    bloodGroup: text("blood_group").notNull(),
    date: date("date").notNull(),
    units: integer("units").notNull().default(1),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("transfusions_bank_date_idx").on(t.bankId, t.date)],
);

/* ───────────────────────── Donors ───────────────────────── */

export const donors = pgTable(
  "donors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    /** Pseudonymous ID shared with Flagsmith and Sarvam. Never the name or phone. */
    ref: text("ref").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    bloodGroup: text("blood_group").notNull(),
    sex: text("sex").$type<"male" | "female">().notNull(),
    language: text("language").notNull().default("en"),
    donorType: text("donor_type").$type<"regular" | "first_time">().notNull().default("regular"),
    city: text("city").notNull(),
    lastDonationOn: date("last_donation_on"),
    consentAt: ts("consent_at"),
    dndCheckedAt: ts("dnd_checked_at"),
    optedOutAt: ts("opted_out_at"),
    deferredUntil: date("deferred_until"),
    isDemoContact: boolean("is_demo_contact").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("donors_bank_group_idx").on(t.bankId, t.bloodGroup)],
);

/* ───────────────────────── Campaigns & calls ───────────────────────── */

export const campaignStatus = pgEnum("campaign_status", [
  "pending_approval",
  "active",
  "completed",
  "cancelled",
]);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    bloodGroup: text("blood_group").notNull(),
    shortageDate: date("shortage_date"),
    gapUnits: integer("gap_units").notNull(),
    bookingsTarget: integer("bookings_target").notNull(),
    windowStart: date("window_start").notNull(),
    windowEnd: date("window_end").notNull(),
    status: campaignStatus("status").notNull().default("pending_approval"),
    approvedBy: text("approved_by"),
    approvedAt: ts("approved_at"),
    completedAt: ts("completed_at"),
    nudgebeeRunRef: text("nudgebee_run_ref"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("campaigns_bank_status_idx").on(t.bankId, t.status)],
);

export const callStatus = pgEnum("call_status", [
  "queued",
  "dialing",
  "in_progress",
  "completed",
  "failed",
  "skipped",
]);

export const callOutcome = pgEnum("call_outcome", [
  "booked",
  "declined",
  "deferred",
  "no_answer",
  "opted_out",
  "failed",
]);

/**
 * The call queue. Workers claim rows with a lease (claimed_by + lease_until)
 * instead of holding a row lock for a 2-minute call; if a pod dies, its lease
 * runs out and another worker picks the job up.
 */
export const callJobs = pgTable(
  "call_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    donorId: uuid("donor_id")
      .notNull()
      .references(() => donors.id, { onDelete: "cascade" }),
    status: callStatus("status").notNull().default("queued"),
    outcome: callOutcome("outcome"),
    priority: integer("priority").notNull().default(100),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    claimedBy: text("claimed_by"),
    leaseUntil: ts("lease_until"),
    sarvamAttemptId: text("sarvam_attempt_id"),
    interactionId: text("interaction_id"),
    durationSec: integer("duration_sec"),
    transcript: jsonb("transcript").$type<{ role: "agent" | "user"; text: string }[]>(),
    healthAnswers: jsonb("health_answers").$type<Record<string, string>>(),
    lastError: text("last_error"),
    simulated: boolean("simulated").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("call_jobs_campaign_donor_uq").on(t.campaignId, t.donorId),
    index("call_jobs_claim_idx")
      .on(t.status, t.nextAttemptAt, t.priority)
      .where(sql`status = 'queued'`),
    index("call_jobs_attempt_idx").on(t.sarvamAttemptId),
  ],
);

/** One row per call in progress, across every worker pod: the global call limit. */
export const callPermits = pgTable("call_permits", {
  jobId: uuid("job_id")
    .primaryKey()
    .references(() => callJobs.id, { onDelete: "cascade" }),
  workerId: text("worker_id").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

export const slots = pgTable(
  "slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    startsAt: ts("starts_at").notNull(),
    capacity: integer("capacity").notNull(),
    booked: integer("booked").notNull().default(0),
  },
  (t) => [uniqueIndex("slots_bank_start_uq").on(t.bankId, t.startsAt)],
);

export const bookingStatus = pgEnum("booking_status", ["booked", "collected", "cancelled", "no_show"]);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    donorId: uuid("donor_id")
      .notNull()
      .references(() => donors.id, { onDelete: "cascade" }),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => slots.id),
    bloodGroup: text("blood_group").notNull(),
    status: bookingStatus("status").notNull().default("booked"),
    /** Sarvam interaction ID (or a simulation key) so a retried tool call never double-books. */
    idempotencyKey: text("idempotency_key").notNull().unique(),
    simulated: boolean("simulated").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("bookings_campaign_donor_uq").on(t.campaignId, t.donorId),
    index("bookings_bank_idx").on(t.bankId, t.createdAt),
  ],
);

/* ───────────────────────── Activity feed ───────────────────────── */

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankId: uuid("bank_id").references(() => banks.id, { onDelete: "cascade" }),
    /** forecast | campaign | call | booking | flag | ops | nudgebee */
    kind: text("kind").notNull(),
    actor: text("actor").notNull(),
    message: text("message").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("events_bank_time_idx").on(t.bankId, t.createdAt)],
);
