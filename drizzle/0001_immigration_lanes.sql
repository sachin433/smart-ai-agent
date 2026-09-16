ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "priority_lane" text DEFAULT 'P1' NOT NULL;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "visa_immigration_status" text DEFAULT 'unknown' NOT NULL;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "visa_confidence" real DEFAULT 0 NOT NULL;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "visa_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "country_code" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "relocation_supported" boolean DEFAULT false NOT NULL;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "work_authorization_required" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "jobs_priority_lane_idx" ON "jobs" ("priority_lane");
CREATE INDEX IF NOT EXISTS "jobs_visa_immigration_status_idx" ON "jobs" ("visa_immigration_status");
