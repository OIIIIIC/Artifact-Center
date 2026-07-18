CREATE TABLE "retention_settings" (
	"id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"max_versions" integer DEFAULT 20 NOT NULL,
	"archive_deprecated_days" integer DEFAULT 90 NOT NULL,
	"storage_quota_bytes" bigint DEFAULT 1099511627776 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "deprecated_at" timestamp with time zone;