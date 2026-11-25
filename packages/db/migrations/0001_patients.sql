ALTER TABLE "scheduled_transfusions" ADD COLUMN "patient_name" text;--> statement-breakpoint
ALTER TABLE "scheduled_transfusions" ADD COLUMN "age" integer;--> statement-breakpoint
ALTER TABLE "scheduled_transfusions" ADD COLUMN "condition" text;--> statement-breakpoint
ALTER TABLE "scheduled_transfusions" ADD COLUMN "hospital" text;--> statement-breakpoint
ALTER TABLE "scheduled_transfusions" ADD COLUMN "every_days" integer;--> statement-breakpoint
ALTER TABLE "scheduled_transfusions" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "scheduled_transfusions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;