ALTER TABLE "release_credentials" DROP CONSTRAINT "release_credentials_application_id_applications_id_fk";
--> statement-breakpoint
DROP INDEX "release_credentials_application_idx";--> statement-breakpoint
ALTER TABLE "release_credentials" DROP COLUMN "application_id";