-- Rename the platform without replacing rows or changing artifact file types/paths.
ALTER TYPE "public"."app_platform" RENAME VALUE 'zip' TO 'linux';
--> statement-breakpoint
ALTER TYPE "public"."artifact_type" ADD VALUE 'tar';
--> statement-breakpoint
ALTER TYPE "public"."artifact_type" ADD VALUE 'tar.gz';
--> statement-breakpoint
ALTER TYPE "public"."artifact_type" ADD VALUE 'deb';
--> statement-breakpoint
ALTER TYPE "public"."artifact_type" ADD VALUE 'rpm';
--> statement-breakpoint
ALTER TYPE "public"."artifact_type" ADD VALUE 'appimage';
--> statement-breakpoint
ALTER TABLE "user_workspace_preferences" DROP CONSTRAINT "user_workspace_preferences_platform_valid";
--> statement-breakpoint
UPDATE "user_workspace_preferences" SET "platform" = 'linux' WHERE "platform" = 'zip';
--> statement-breakpoint
ALTER TABLE "user_workspace_preferences" ADD CONSTRAINT "user_workspace_preferences_platform_valid" CHECK ("platform" in ('all', 'android', 'windows', 'linux'));
