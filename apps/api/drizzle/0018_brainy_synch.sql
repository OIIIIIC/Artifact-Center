DROP INDEX "applications_region_code_uidx";--> statement-breakpoint
CREATE INDEX "applications_region_code_idx" ON "applications" USING btree ("region_id","application_code");