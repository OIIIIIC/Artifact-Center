CREATE TYPE "public"."app_platform" AS ENUM('android', 'windows', 'zip');--> statement-breakpoint
CREATE TYPE "public"."app_status" AS ENUM('active', 'new', 'beta', 'deprecated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."artifact_status" AS ENUM('latest', 'stable', 'beta', 'deprecated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."release_channel" AS ENUM('stable', 'beta', 'internal', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'maintainer', 'viewer');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"package_name" varchar(255) NOT NULL,
	"platform" "app_platform" NOT NULL,
	"repository" varchar(500) DEFAULT '' NOT NULL,
	"status" "app_status" DEFAULT 'new' NOT NULL,
	"owner_id" uuid,
	"owner_name" varchar(120) DEFAULT '' NOT NULL,
	"latest_version" varchar(64) DEFAULT '' NOT NULL,
	"artifact_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"version" varchar(64) NOT NULL,
	"build_number" varchar(64) DEFAULT '' NOT NULL,
	"platform" "app_platform" NOT NULL,
	"channel" "release_channel" DEFAULT 'stable' NOT NULL,
	"status" "artifact_status" DEFAULT 'stable' NOT NULL,
	"filename" varchar(500) NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"sha256" varchar(64),
	"storage_key" text NOT NULL,
	"release_notes" text DEFAULT '' NOT NULL,
	"uploader_id" uuid,
	"uploader_name" varchar(120) DEFAULT '' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'maintainer' NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_package_name_uidx" ON "applications" USING btree ("package_name");--> statement-breakpoint
CREATE UNIQUE INDEX "artifacts_app_version_uidx" ON "artifacts" USING btree ("application_id","version");