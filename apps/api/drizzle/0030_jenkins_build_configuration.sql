CREATE TABLE "application_build_configs" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"job_path" varchar(300) NOT NULL,
	"artifact_pattern" varchar(300) NOT NULL,
	"parameters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jenkins_connections" (
	"id" varchar(16) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"base_url" varchar(500) NOT NULL,
	"username" varchar(120) NOT NULL,
	"token_ciphertext" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jenkins_connections_singleton" CHECK ("jenkins_connections"."id" = 'default')
);
--> statement-breakpoint
ALTER TABLE "application_build_configs" ADD CONSTRAINT "application_build_configs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;