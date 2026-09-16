ALTER TABLE "codex_kitchen"."login_alerts" ADD COLUMN "action" text DEFAULT 'login' NOT NULL;--> statement-breakpoint
ALTER TABLE "codex_kitchen"."login_alerts" ADD COLUMN "target" text;