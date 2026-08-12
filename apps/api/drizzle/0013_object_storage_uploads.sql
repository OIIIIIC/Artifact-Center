ALTER TABLE "artifacts" ADD COLUMN IF NOT EXISTS "storage_backend" varchar(16) DEFAULT 'local' NOT NULL;
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "storage_backend" varchar(16) DEFAULT 'local' NOT NULL;
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "object_upload_id" text;
--> statement-breakpoint
ALTER TABLE "upload_parts" ADD COLUMN IF NOT EXISTS "etag" varchar(128);
