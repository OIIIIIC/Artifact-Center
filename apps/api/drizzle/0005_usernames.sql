ALTER TABLE "users" ADD COLUMN "username" varchar(64);--> statement-breakpoint
WITH normalized AS (
  SELECT
    "id",
    COALESCE(
      NULLIF(regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9_.-]', '_', 'g'), ''),
      'user'
    ) AS base,
    row_number() OVER (
      PARTITION BY lower(split_part("email", '@', 1))
      ORDER BY "id"
    ) AS suffix
  FROM "users"
)
UPDATE "users" AS u
SET "username" = CASE
  WHEN n.suffix = 1 THEN left(n.base, 64)
  ELSE left(n.base, 58) || '_' || n.suffix
END
FROM normalized AS n
WHERE u."id" = n."id";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uidx" ON "users" USING btree ("username");
