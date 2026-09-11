CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "artifacts_search_trgm_idx" ON "artifacts" USING gin (("version" || ' ' || "filename" || ' ' || "original_filename" || ' ' || "build_number" || ' ' || "uploader_name" || ' ' || "release_notes") gin_trgm_ops);