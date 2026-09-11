CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Add nullable, backfill without changing application identity, then enforce ownership.
ALTER TABLE "applications" ADD COLUMN "project_id" uuid DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_product_id_regions_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_product_name_uidx" ON "projects" USING btree ("product_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_product_id_uidx" ON "projects" USING btree ("product_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_default_uidx" ON "projects" USING btree ("product_id") WHERE "projects"."is_default" = true;--> statement-breakpoint
CREATE INDEX "projects_product_sort_idx" ON "projects" USING btree ("product_id","sort_order","name");--> statement-breakpoint
INSERT INTO "projects" ("product_id", "name", "is_default")
SELECT "id", '默认项目', true FROM "regions";--> statement-breakpoint
UPDATE "applications" a SET "project_id" = p."id"
FROM "projects" p WHERE p."product_id" = a."region_id" AND p."is_default";--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_product_project_fk" FOREIGN KEY ("region_id","project_id") REFERENCES "public"."projects"("product_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_project_idx" ON "applications" USING btree ("project_id");
--> statement-breakpoint
-- Catalog compatibility: every newly created product has a stable default project.
CREATE FUNCTION create_product_default_project() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO projects (product_id, name, is_default) VALUES (NEW.id, '默认项目', true);
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER products_default_project AFTER INSERT ON regions
FOR EACH ROW EXECUTE FUNCTION create_product_default_project();--> statement-breakpoint
-- Old API clients and seed/import writers may omit project_id.
CREATE FUNCTION assign_default_project() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.region_id IS DISTINCT FROM OLD.region_id AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id) THEN
    SELECT id INTO NEW.project_id FROM projects WHERE product_id = NEW.region_id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER applications_default_project BEFORE INSERT OR UPDATE OF region_id, project_id ON applications
FOR EACH ROW EXECUTE FUNCTION assign_default_project();
