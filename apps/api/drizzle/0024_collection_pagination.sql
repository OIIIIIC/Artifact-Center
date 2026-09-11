DROP INDEX "artifacts_application_uploaded_at_idx";--> statement-breakpoint
DROP INDEX "releases_application_published_at_idx";--> statement-breakpoint
CREATE INDEX "applications_updated_page_idx" ON "applications" USING btree ("updated_at","id");--> statement-breakpoint
CREATE INDEX "applications_created_page_idx" ON "applications" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "applications_name_page_idx" ON "applications" USING btree ("name","id");--> statement-breakpoint
CREATE INDEX "artifacts_application_history_idx" ON "artifacts" USING btree ("application_id","uploaded_at","id");--> statement-breakpoint
CREATE INDEX "releases_application_history_idx" ON "releases" USING btree ("application_id","published_at","id");