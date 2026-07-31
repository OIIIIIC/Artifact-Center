CREATE INDEX "artifacts_application_sha256_idx" ON "artifacts" USING btree ("application_id","sha256");
