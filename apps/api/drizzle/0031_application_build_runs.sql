CREATE TABLE "application_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"requested_by_id" uuid,
	"requested_by_name" varchar(120) NOT NULL,
	"base_url" varchar(500) NOT NULL,
	"username" varchar(120) NOT NULL,
	"job_path" varchar(300) NOT NULL,
	"config_revision" integer NOT NULL,
	"artifact_pattern" varchar(300) NOT NULL,
	"parameters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"queue_id" bigint,
	"build_number" integer,
	"commits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"cancel_requested_at" timestamp with time zone,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"next_sync_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_builds_status_check" CHECK ("application_builds"."status" in ('pending','submitting','queued','running','success','failure','unstable','aborted','unknown'))
);
--> statement-breakpoint
CREATE TABLE "build_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid NOT NULL,
	"relative_path" varchar(1000) NOT NULL,
	"version" varchar(64) NOT NULL,
	"channel" varchar(16) DEFAULT 'beta' NOT NULL,
	"release_notes" text DEFAULT '' NOT NULL,
	"requested_by_id" uuid,
	"requested_by_name" varchar(120) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"artifact_id" uuid,
	"storage_key" text,
	"error" text,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "build_publications_status_check" CHECK ("build_publications"."status" in ('pending','importing','published','failed')),
	CONSTRAINT "build_publications_channel_check" CHECK ("build_publications"."channel" in ('beta','stable'))
);
--> statement-breakpoint
ALTER TABLE "application_builds" ADD CONSTRAINT "application_builds_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_builds" ADD CONSTRAINT "application_builds_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_publications" ADD CONSTRAINT "build_publications_build_id_application_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."application_builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_publications" ADD CONSTRAINT "build_publications_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_publications" ADD CONSTRAINT "build_publications_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_builds_request_key_uidx" ON "application_builds" USING btree ("application_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "application_builds_active_uidx" ON "application_builds" USING btree ("application_id") WHERE "application_builds"."status" in ('pending','submitting','queued','running');--> statement-breakpoint
CREATE INDEX "application_builds_history_idx" ON "application_builds" USING btree ("application_id","created_at","id");--> statement-breakpoint
CREATE INDEX "application_builds_sync_idx" ON "application_builds" USING btree ("next_sync_at") WHERE "application_builds"."status" in ('pending','submitting','queued','running','unknown');--> statement-breakpoint
CREATE UNIQUE INDEX "build_publications_file_uidx" ON "build_publications" USING btree ("build_id","relative_path");--> statement-breakpoint
CREATE INDEX "build_publications_pending_idx" ON "build_publications" USING btree ("status","lease_until");