ALTER TABLE "application_build_configs" ADD COLUMN "output_targets" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "application_builds" ADD COLUMN "output_targets" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "build_publications" ADD COLUMN "target_application_id" uuid;--> statement-breakpoint
ALTER TABLE "build_publications" ADD CONSTRAINT "build_publications_target_application_id_applications_id_fk" FOREIGN KEY ("target_application_id") REFERENCES "public"."applications"("id") ON DELETE restrict ON UPDATE no action;