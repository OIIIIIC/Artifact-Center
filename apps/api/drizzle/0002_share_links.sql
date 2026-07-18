CREATE TYPE "public"."share_mode" AS ENUM('latest', 'artifact');--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(64) NOT NULL,
	"application_id" uuid NOT NULL,
	"mode" "share_mode" DEFAULT 'latest' NOT NULL,
	"artifact_id" uuid,
	"created_by_id" uuid,
	"created_by_name" varchar(120) DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_links_application_id_idx" ON "share_links" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "share_links_token_idx" ON "share_links" USING btree ("token");