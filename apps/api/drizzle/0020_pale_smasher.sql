CREATE TABLE "user_application_preferences" (
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"favorite_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_workspace_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"platform" varchar(16) DEFAULT 'all' NOT NULL,
	"sort" varchar(16) DEFAULT 'updated' NOT NULL,
	"region_id" uuid,
	"collapsed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_workspace_preferences_platform_valid" CHECK ("user_workspace_preferences"."platform" in ('all', 'android', 'windows', 'zip')),
	CONSTRAINT "user_workspace_preferences_sort_valid" CHECK ("user_workspace_preferences"."sort" in ('updated', 'name', 'created'))
);
--> statement-breakpoint
ALTER TABLE "user_application_preferences" ADD CONSTRAINT "user_application_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_application_preferences" ADD CONSTRAINT "user_application_preferences_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_workspace_preferences" ADD CONSTRAINT "user_workspace_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_workspace_preferences" ADD CONSTRAINT "user_workspace_preferences_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_application_preferences_user_application_uidx" ON "user_application_preferences" USING btree ("user_id","application_id");--> statement-breakpoint
CREATE INDEX "user_application_preferences_favorite_idx" ON "user_application_preferences" USING btree ("user_id","favorite","favorite_at");--> statement-breakpoint
CREATE INDEX "user_application_preferences_recent_idx" ON "user_application_preferences" USING btree ("user_id","last_viewed_at");