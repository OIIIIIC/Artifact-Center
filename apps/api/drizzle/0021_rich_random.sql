ALTER TABLE "user_workspace_preferences" ADD COLUMN "search_query" varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_workspace_preferences" ADD COLUMN "favorite_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_workspace_preferences" ADD COLUMN "responsible_only" boolean DEFAULT false NOT NULL;