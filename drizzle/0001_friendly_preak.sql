CREATE TABLE "codex_kitchen"."auth_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codex_kitchen"."login_alerts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "codex_kitchen"."members" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."members" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."members" ADD COLUMN "require_email_verification" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."members" ADD CONSTRAINT "members_username_unique" UNIQUE("username");