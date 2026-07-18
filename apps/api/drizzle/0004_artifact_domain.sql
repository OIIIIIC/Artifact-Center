CREATE TYPE "public"."application_member_role" AS ENUM('maintainer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('apk', 'aab', 'exe', 'zip');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('published', 'deprecated', 'archived');--> statement-breakpoint

CREATE TABLE "application_members" (
	"application_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "application_member_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_members_application_user_uidx" UNIQUE("application_id", "user_id")
);--> statement-breakpoint
ALTER TABLE "application_members" ADD CONSTRAINT "application_members_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_members" ADD CONSTRAINT "application_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_members_user_application_idx" ON "application_members" USING btree ("user_id", "application_id");--> statement-breakpoint
INSERT INTO "application_members" ("application_id", "user_id", "role")
SELECT "id", "owner_id", 'maintainer'::"application_member_role"
FROM "applications"
WHERE "owner_id" IS NOT NULL
ON CONFLICT ("application_id", "user_id") DO NOTHING;--> statement-breakpoint

CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"version" varchar(64) NOT NULL,
	"release_notes" text DEFAULT '' NOT NULL,
	"status" "release_status" DEFAULT 'published' NOT NULL,
	"created_by_id" uuid,
	"created_by_name" varchar(120) DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "releases_application_version_uidx" UNIQUE("application_id", "version")
);--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "releases_application_published_at_idx" ON "releases" USING btree ("application_id", "published_at");--> statement-breakpoint

ALTER TABLE "artifacts" ADD COLUMN "release_id" uuid;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "type" "artifact_type";--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "parsed_meta" jsonb;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "build_meta" jsonb;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
INSERT INTO "releases" ("application_id", "version", "release_notes", "status", "created_by_id", "created_by_name", "published_at")
SELECT "application_id", "version", "release_notes",
	CASE WHEN "status" = 'archived' THEN 'archived'::"release_status"
		 WHEN "status" = 'deprecated' THEN 'deprecated'::"release_status"
		 ELSE 'published'::"release_status" END,
	"uploader_id", "uploader_name", "uploaded_at"
FROM "artifacts"
ON CONFLICT ("application_id", "version") DO NOTHING;--> statement-breakpoint
UPDATE "artifacts" AS a
SET "release_id" = r."id",
	"type" = CASE
		WHEN lower(a."filename") LIKE '%.apk' THEN 'apk'::"artifact_type"
		WHEN lower(a."filename") LIKE '%.aab' THEN 'aab'::"artifact_type"
		WHEN lower(a."filename") LIKE '%.exe' OR lower(a."filename") LIKE '%.msi' THEN 'exe'::"artifact_type"
		ELSE 'zip'::"artifact_type"
	END
FROM "releases" AS r
WHERE r."application_id" = a."application_id" AND r."version" = a."version";--> statement-breakpoint
ALTER TABLE "artifacts" ALTER COLUMN "release_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" DROP CONSTRAINT "artifacts_uploader_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" DROP CONSTRAINT "applications_owner_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DROP INDEX "artifacts_app_version_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "artifacts_release_type_build_uidx" ON "artifacts" USING btree ("release_id", "type", "build_number");--> statement-breakpoint
CREATE UNIQUE INDEX "artifacts_one_latest_per_application_uidx" ON "artifacts" USING btree ("application_id") WHERE "status" = 'latest';--> statement-breakpoint
CREATE INDEX "artifacts_application_uploaded_at_idx" ON "artifacts" USING btree ("application_id", "uploaded_at");--> statement-breakpoint
CREATE INDEX "artifacts_release_id_idx" ON "artifacts" USING btree ("release_id");--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_size_bytes_nonnegative" CHECK ("size_bytes" >= 0);--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."sync_application_artifact_summary"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	target_application_id uuid;
BEGIN
	IF TG_OP = 'DELETE' THEN
		target_application_id := OLD.application_id;
	ELSE
		target_application_id := NEW.application_id;
	END IF;

	UPDATE "applications"
	SET
		"artifact_count" = (
			SELECT count(*)::integer FROM "artifacts"
			WHERE "application_id" = target_application_id
		),
		"latest_version" = COALESCE((
			SELECT "version" FROM "artifacts"
			WHERE "application_id" = target_application_id
			ORDER BY ("status" = 'latest') DESC, "uploaded_at" DESC
			LIMIT 1
		), ''),
		"updated_at" = now()
	WHERE "id" = target_application_id;
	RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "artifacts_sync_application_summary"
AFTER INSERT OR UPDATE OR DELETE ON "artifacts"
FOR EACH ROW EXECUTE FUNCTION "public"."sync_application_artifact_summary"();--> statement-breakpoint

ALTER TABLE "share_links" DROP CONSTRAINT "share_links_artifact_id_artifacts_id_fk";--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 已删除制品遗留的固定链接无法再解析，迁移时移除；latest 模式始终不绑定具体制品。
DELETE FROM "share_links" WHERE "mode" = 'artifact' AND "artifact_id" IS NULL;--> statement-breakpoint
UPDATE "share_links" SET "artifact_id" = NULL WHERE "mode" = 'latest' AND "artifact_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_mode_artifact_check" CHECK (("mode" = 'latest' AND "artifact_id" IS NULL) OR ("mode" = 'artifact' AND "artifact_id" IS NOT NULL));--> statement-breakpoint
DROP INDEX "share_links_token_idx";--> statement-breakpoint
CREATE INDEX "share_links_application_created_at_idx" ON "share_links" USING btree ("application_id", "created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_application_created_at_idx" ON "audit_logs" USING btree ("application_id", "created_at");--> statement-breakpoint
