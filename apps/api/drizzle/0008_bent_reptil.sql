CREATE TYPE "public"."share_kind" AS ENUM('single', 'collection');--> statement-breakpoint
CREATE TABLE "share_link_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_link_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"mode" "share_mode" DEFAULT 'latest' NOT NULL,
	"artifact_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "kind" "share_kind" DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "title" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "region_id" uuid;--> statement-breakpoint
ALTER TABLE "share_link_items" ADD CONSTRAINT "share_link_items_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link_items" ADD CONSTRAINT "share_link_items_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link_items" ADD CONSTRAINT "share_link_items_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "share_links" AS share
SET "region_id" = app."region_id",
    "title" = app."name"
FROM "applications" AS app
WHERE app."id" = share."application_id";--> statement-breakpoint
INSERT INTO "share_link_items" (
	"share_link_id",
	"application_id",
	"mode",
	"artifact_id",
	"sort_order",
	"download_count"
)
SELECT
	"id",
	"application_id",
	"mode",
	"artifact_id",
	0,
	"download_count"
FROM "share_links";--> statement-breakpoint
CREATE UNIQUE INDEX "share_link_items_share_application_uidx" ON "share_link_items" USING btree ("share_link_id","application_id");--> statement-breakpoint
CREATE INDEX "share_link_items_share_sort_idx" ON "share_link_items" USING btree ("share_link_id","sort_order");--> statement-breakpoint
CREATE INDEX "share_link_items_application_idx" ON "share_link_items" USING btree ("application_id");--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;
