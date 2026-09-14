ALTER TABLE "projects" ADD COLUMN "code" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "projects_product_code_uidx" ON "projects" USING btree ("product_id","code");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_code_check" CHECK ("projects"."code" IS NULL OR "projects"."code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');