CREATE SCHEMA "codex_kitchen";
--> statement-breakpoint
CREATE TABLE "codex_kitchen"."assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_pathname_unique" UNIQUE("pathname")
);
--> statement-breakpoint
CREATE TABLE "codex_kitchen"."members" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codex_kitchen"."projects" (
	"id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"document" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
ALTER TABLE "codex_kitchen"."assets" ADD CONSTRAINT "assets_owner_id_project_id_projects_owner_id_id_fk" FOREIGN KEY ("owner_id","project_id") REFERENCES "codex_kitchen"."projects"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_owner_project" ON "codex_kitchen"."assets" USING btree ("owner_id","project_id");--> statement-breakpoint
CREATE INDEX "projects_owner_updated" ON "codex_kitchen"."projects" USING btree ("owner_id","updated_at");