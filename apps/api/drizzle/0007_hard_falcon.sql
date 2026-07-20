CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "regions" ("code", "name", "sort_order", "enabled")
VALUES ('default', '默认地域', 0, true);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "region_id" uuid;--> statement-breakpoint
UPDATE "applications"
SET "region_id" = (SELECT "id" FROM "regions" WHERE "code" = 'default');--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "region_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "regions_code_uidx" ON "regions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_name_uidx" ON "regions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "regions_sort_order_idx" ON "regions" USING btree ("sort_order","name");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE restrict ON UPDATE no action;
