CREATE TYPE "public"."upload_session_status" AS ENUM('active', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TABLE "upload_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "uploader_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "resume_key" varchar(160) NOT NULL,
  "filename" varchar(500) NOT NULL,
  "size_bytes" bigint NOT NULL,
  "fields" jsonb NOT NULL,
  "storage_key" text NOT NULL,
  "part_size" integer NOT NULL,
  "part_count" integer NOT NULL,
  "status" "upload_session_status" DEFAULT 'active' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "upload_sessions_size_nonnegative" CHECK ("size_bytes" > 0),
  CONSTRAINT "upload_sessions_part_count_positive" CHECK ("part_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "upload_parts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "upload_sessions"("id") ON DELETE cascade,
  "part_number" integer NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "upload_parts_number_positive" CHECK ("part_number" > 0),
  CONSTRAINT "upload_parts_size_positive" CHECK ("size_bytes" > 0),
  CONSTRAINT "upload_parts_session_number_uidx" UNIQUE("session_id", "part_number")
);
--> statement-breakpoint
CREATE INDEX "upload_sessions_resume_idx" ON "upload_sessions" USING btree ("application_id", "uploader_id", "resume_key");
--> statement-breakpoint
CREATE INDEX "upload_sessions_expires_idx" ON "upload_sessions" USING btree ("status", "expires_at");
