ALTER TABLE "applications" ADD COLUMN "application_code" varchar(48);--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "original_filename" varchar(500);--> statement-breakpoint
UPDATE "artifacts" SET "original_filename" = "filename";--> statement-breakpoint
WITH "normalized_codes" AS (
	SELECT
		"id",
		"region_id",
		COALESCE(
			NULLIF(
				TRIM(BOTH '-' FROM LEFT(regexp_replace(lower(regexp_replace("package_name", '^.*[./]', '')), '[^a-z0-9]+', '-', 'g'), 39)),
				''
			),
			'app'
		) AS "base_code"
	FROM "applications"
),
"ranked_codes" AS (
	SELECT
		"id",
		"base_code",
		row_number() OVER (PARTITION BY "region_id", "base_code" ORDER BY "id") AS "ordinal"
	FROM "normalized_codes"
)
UPDATE "applications" AS "application"
SET "application_code" = CASE
	WHEN "ranked_codes"."ordinal" = 1 THEN "ranked_codes"."base_code"
	ELSE "ranked_codes"."base_code" || '-' || substring("application"."id"::text, 1, 8)
END
FROM "ranked_codes"
WHERE "application"."id" = "ranked_codes"."id";--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "application_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ALTER COLUMN "original_filename" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_region_code_uidx" ON "applications" USING btree ("region_id","application_code");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_application_code_format" CHECK ("applications"."application_code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
