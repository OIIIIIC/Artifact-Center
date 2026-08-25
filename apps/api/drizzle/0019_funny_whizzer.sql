ALTER TABLE "applications" ADD COLUMN "icon_key" varchar(32) DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "icon_color" varchar(32) DEFAULT 'auto' NOT NULL;