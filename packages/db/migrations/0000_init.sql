CREATE TYPE "public"."booking_status" AS ENUM('booked', 'collected', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."call_outcome" AS ENUM('booked', 'declined', 'deferred', 'no_answer', 'opted_out', 'failed');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('queued', 'dialing', 'in_progress', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."camp_status" AS ENUM('planned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('pending_approval', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('coordinator', 'medical_officer', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"demo_date" date,
	"stock_as_of" date NOT NULL,
	"usage_per_day" jsonb NOT NULL,
	"group_mix" jsonb NOT NULL,
	"walk_in_per_day" real NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "banks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"campaign_id" uuid,
	"donor_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"blood_group" text NOT NULL,
	"status" "booking_status" DEFAULT 'booked' NOT NULL,
	"idempotency_key" text NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "call_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"donor_id" uuid NOT NULL,
	"status" "call_status" DEFAULT 'queued' NOT NULL,
	"outcome" "call_outcome",
	"priority" integer DEFAULT 100 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_by" text,
	"lease_until" timestamp with time zone,
	"sarvam_attempt_id" text,
	"interaction_id" text,
	"duration_sec" integer,
	"transcript" jsonb,
	"health_answers" jsonb,
	"last_error" text,
	"simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_permits" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"blood_group" text NOT NULL,
	"shortage_date" date,
	"gap_units" integer NOT NULL,
	"bookings_target" integer NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"status" "campaign_status" DEFAULT 'pending_approval' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"nudgebee_run_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "camps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"expected_units" integer NOT NULL,
	"status" "camp_status" DEFAULT 'planned' NOT NULL,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"ref" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"blood_group" text NOT NULL,
	"sex" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"donor_type" text DEFAULT 'regular' NOT NULL,
	"city" text NOT NULL,
	"last_donation_on" date,
	"consent_at" timestamp with time zone,
	"dnd_checked_at" timestamp with time zone,
	"opted_out_at" timestamp with time zone,
	"deferred_until" date,
	"is_demo_contact" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donors_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid,
	"kind" text NOT NULL,
	"actor" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "festival_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"name" text NOT NULL,
	"start" date NOT NULL,
	"end" date NOT NULL,
	"collection_factor" real NOT NULL,
	"demand_factor" real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bank_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'coordinator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"booked" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"blood_group" text NOT NULL,
	"component" text DEFAULT 'PRBC' NOT NULL,
	"units" integer NOT NULL,
	"expires_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_transfusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"label" text NOT NULL,
	"blood_group" text NOT NULL,
	"date" date NOT NULL,
	"units" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_jobs" ADD CONSTRAINT "call_jobs_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_jobs" ADD CONSTRAINT "call_jobs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_jobs" ADD CONSTRAINT "call_jobs_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_permits" ADD CONSTRAINT "call_permits_job_id_call_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."call_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camps" ADD CONSTRAINT "camps_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donors" ADD CONSTRAINT "donors_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_transfusions" ADD CONSTRAINT "scheduled_transfusions_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_campaign_donor_uq" ON "bookings" USING btree ("campaign_id","donor_id");--> statement-breakpoint
CREATE INDEX "bookings_bank_idx" ON "bookings" USING btree ("bank_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "call_jobs_campaign_donor_uq" ON "call_jobs" USING btree ("campaign_id","donor_id");--> statement-breakpoint
CREATE INDEX "call_jobs_claim_idx" ON "call_jobs" USING btree ("status","next_attempt_at","priority") WHERE status = 'queued';--> statement-breakpoint
CREATE INDEX "call_jobs_attempt_idx" ON "call_jobs" USING btree ("sarvam_attempt_id");--> statement-breakpoint
CREATE INDEX "campaigns_bank_status_idx" ON "campaigns" USING btree ("bank_id","status");--> statement-breakpoint
CREATE INDEX "camps_bank_date_idx" ON "camps" USING btree ("bank_id","date");--> statement-breakpoint
CREATE INDEX "donors_bank_group_idx" ON "donors" USING btree ("bank_id","blood_group");--> statement-breakpoint
CREATE INDEX "events_bank_time_idx" ON "events" USING btree ("bank_id","created_at");--> statement-breakpoint
CREATE INDEX "festival_state_idx" ON "festival_windows" USING btree ("state","start");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_user_bank_uq" ON "memberships" USING btree ("user_id","bank_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slots_bank_start_uq" ON "slots" USING btree ("bank_id","starts_at");--> statement-breakpoint
CREATE INDEX "stock_bank_group_idx" ON "stock_lots" USING btree ("bank_id","blood_group","expires_on");--> statement-breakpoint
CREATE INDEX "transfusions_bank_date_idx" ON "scheduled_transfusions" USING btree ("bank_id","date");