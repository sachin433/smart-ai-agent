CREATE TYPE "public"."job_status" AS ENUM('discovered', 'validated', 'matched', 'notified', 'saved', 'rejected', 'applied', 'interview', 'offer', 'closed');--> statement-breakpoint
CREATE TYPE "public"."relevance_tier" AS ENUM('exceptional', 'strong', 'potential', 'low');--> statement-breakpoint
CREATE TYPE "public"."remote_type" AS ENUM('onsite', 'hybrid', 'remote', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."scan_task_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."visa_status" AS ENUM('required', 'available', 'not_available', 'unknown');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"careers_url" text,
	"ats_type" text NOT NULL,
	"ats_slug" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"watchlist" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_events" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_job_id" text,
	"canonical_url" text NOT NULL,
	"company_id" text,
	"company_name" text NOT NULL,
	"title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"normalized_locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"remote_type" "remote_type" DEFAULT 'unknown' NOT NULL,
	"remote_regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"employment_type" text,
	"seniority" text,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" text,
	"visa_sponsorship" "visa_status" DEFAULT 'unknown' NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text NOT NULL,
	"status" "job_status" DEFAULT 'discovered' NOT NULL,
	"relevance_score" real DEFAULT 0 NOT NULL,
	"relevance_tier" "relevance_tier" DEFAULT 'low' NOT NULL,
	"analysis" jsonb,
	"match_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"concerns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"notification_type" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"profile" jsonb NOT NULL,
	"notification_threshold" text DEFAULT 'strong' NOT NULL,
	"min_relevance_score" real DEFAULT 0.55 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"jobs_discovered" integer DEFAULT 0 NOT NULL,
	"jobs_new" integer DEFAULT 0 NOT NULL,
	"jobs_relevant" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"scan_run_id" text NOT NULL,
	"task_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "scan_task_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_health" (
	"source" text PRIMARY KEY NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_error" text,
	"jobs_found" integer DEFAULT 0 NOT NULL,
	"relevant_jobs" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_tasks" ADD CONSTRAINT "scan_tasks_scan_run_id_scan_runs_id_fk" FOREIGN KEY ("scan_run_id") REFERENCES "public"."scan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_events_job_id_idx" ON "job_events" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_job_id_idx" ON "jobs" USING btree ("source","source_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_canonical_url_idx" ON "jobs" USING btree ("canonical_url");--> statement-breakpoint
CREATE INDEX "jobs_company_id_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "jobs_first_seen_at_idx" ON "jobs" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "jobs_relevance_tier_idx" ON "jobs" USING btree ("relevance_tier");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_content_hash_idx" ON "jobs" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_job_type_idx" ON "notifications" USING btree ("job_id","notification_type");--> statement-breakpoint
CREATE INDEX "scan_tasks_run_status_idx" ON "scan_tasks" USING btree ("scan_run_id","status");