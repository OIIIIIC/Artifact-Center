ALTER TABLE "jenkins_connections" DROP CONSTRAINT "jenkins_connections_singleton";--> statement-breakpoint
ALTER TABLE "application_build_configs" ADD COLUMN "connection_id" varchar(16) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_builds" ADD COLUMN "connection_id" varchar(16) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "jenkins_connections" ADD COLUMN "name" varchar(120) DEFAULT 'Jenkins' NOT NULL;