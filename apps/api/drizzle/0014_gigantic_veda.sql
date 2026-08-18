CREATE TABLE "release_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"channel" "release_channel" DEFAULT 'beta' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_credentials_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "release_credentials" ADD CONSTRAINT "release_credentials_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "release_credentials" ADD CONSTRAINT "release_credentials_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "release_credentials_application_idx" ON "release_credentials" USING btree ("application_id","created_at");
--> statement-breakpoint
CREATE INDEX "release_credentials_actor_idx" ON "release_credentials" USING btree ("actor_user_id");
