CREATE TABLE "codex_kitchen"."businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Proposed migration: legacy members/projects belong to Luxus. Do not apply to live without approval.
INSERT INTO "codex_kitchen"."businesses" ("id", "name") VALUES ('luxus', 'Luxus Elemente'), ('devonly', 'Devonly Holdings');
--> statement-breakpoint
CREATE TABLE "codex_kitchen"."presence" (
	"user_id" text PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"last_seen" timestamp with time zone NOT NULL,
	"last_active" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "codex_kitchen"."members" ADD COLUMN "business_id" text DEFAULT 'luxus' NOT NULL;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."members" ADD COLUMN "monthly_target" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."projects" ADD COLUMN "business_id" text DEFAULT 'luxus' NOT NULL;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."projects" ADD COLUMN "review_status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."projects" ADD COLUMN "review_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."projects" ADD COLUMN "reviewed_revision" integer;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."projects" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."presence" ADD CONSTRAINT "presence_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "codex_kitchen"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."members" ADD CONSTRAINT "members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "codex_kitchen"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."projects" ADD CONSTRAINT "projects_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "codex_kitchen"."businesses"("id") ON DELETE no action ON UPDATE no action;
