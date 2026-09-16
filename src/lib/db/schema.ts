import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  real,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

export const jobStatusEnum = pgEnum("job_status", [
  "discovered",
  "validated",
  "matched",
  "notified",
  "saved",
  "rejected",
  "applied",
  "interview",
  "offer",
  "closed",
]);

export const relevanceTierEnum = pgEnum("relevance_tier", [
  "exceptional",
  "strong",
  "potential",
  "low",
]);

export const remoteTypeEnum = pgEnum("remote_type", [
  "onsite",
  "hybrid",
  "remote",
  "unknown",
]);

export const visaStatusEnum = pgEnum("visa_status", [
  "required",
  "available",
  "not_available",
  "unknown",
]);

export const scanTaskStatusEnum = pgEnum("scan_task_status", [
  "pending",
  "running",
  "done",
  "failed",
]);

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  careersUrl: text("careers_url"),
  atsType: text("ats_type").notNull(),
  atsSlug: text("ats_slug").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  watchlist: boolean("watchlist").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceJobId: text("source_job_id"),
    canonicalUrl: text("canonical_url").notNull(),
    companyId: text("company_id").references(() => companies.id),
    companyName: text("company_name").notNull(),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    description: text("description").notNull().default(""),
    locations: jsonb("locations").$type<string[]>().notNull().default([]),
    normalizedLocations: jsonb("normalized_locations").$type<string[]>().notNull().default([]),
    remoteType: remoteTypeEnum("remote_type").notNull().default("unknown"),
    remoteRegions: jsonb("remote_regions").$type<string[]>().notNull().default([]),
    employmentType: text("employment_type"),
    seniority: text("seniority"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: text("salary_currency"),
    visaSponsorship: visaStatusEnum("visa_sponsorship").notNull().default("unknown"),
    priorityLane: text("priority_lane").notNull().default("P1"),
    visaImmigrationStatus: text("visa_immigration_status").notNull().default("unknown"),
    visaConfidence: real("visa_confidence").notNull().default(0),
    visaEvidence: jsonb("visa_evidence").$type<Record<string, unknown>>().notNull().default({}),
    countryCode: text("country_code"),
    relocationSupported: boolean("relocation_supported").notNull().default(false),
    workAuthorizationRequired: boolean("work_authorization_required").notNull().default(false),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    contentHash: text("content_hash").notNull(),
    status: jobStatusEnum("status").notNull().default("discovered"),
    relevanceScore: real("relevance_score").notNull().default(0),
    relevanceTier: relevanceTierEnum("relevance_tier").notNull().default("low"),
    analysis: jsonb("analysis").$type<Record<string, unknown>>(),
    matchReasons: jsonb("match_reasons").$type<string[]>().notNull().default([]),
    concerns: jsonb("concerns").$type<string[]>().notNull().default([]),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("jobs_source_job_id_idx").on(table.source, table.sourceJobId),
    uniqueIndex("jobs_canonical_url_idx").on(table.canonicalUrl),
    index("jobs_company_id_idx").on(table.companyId),
    index("jobs_first_seen_at_idx").on(table.firstSeenAt),
    index("jobs_relevance_tier_idx").on(table.relevanceTier),
    index("jobs_status_idx").on(table.status),
    index("jobs_content_hash_idx").on(table.contentHash),
    index("jobs_priority_lane_idx").on(table.priorityLane),
    index("jobs_visa_immigration_status_idx").on(table.visaImmigrationStatus),
  ],
);

export const jobEvents = pgTable(
  "job_events",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    eventType: text("event_type").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("job_events_job_id_idx").on(table.jobId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    notificationType: text("notification_type").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notifications_job_type_idx").on(table.jobId, table.notificationType),
  ],
);

export const scanRuns = pgTable("scan_runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  jobsDiscovered: integer("jobs_discovered").notNull().default(0),
  jobsNew: integer("jobs_new").notNull().default(0),
  jobsRelevant: integer("jobs_relevant").notNull().default(0),
  errors: jsonb("errors").$type<string[]>().notNull().default([]),
  funnelStats: jsonb("funnel_stats").$type<Record<string, unknown>>(),
});

export const scanTasks = pgTable(
  "scan_tasks",
  {
    id: text("id").primaryKey(),
    scanRunId: text("scan_run_id")
      .notNull()
      .references(() => scanRuns.id),
    taskType: text("task_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: scanTaskStatusEnum("status").notNull().default("pending"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scan_tasks_run_status_idx").on(table.scanRunId, table.status),
  ],
);

export const sourceHealth = pgTable("source_health", {
  source: text("source").primaryKey(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
  lastError: text("last_error"),
  jobsFound: integer("jobs_found").notNull().default(0),
  relevantJobs: integer("relevant_jobs").notNull().default(0),
  status: text("status").notNull().default("unknown"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const preferences = pgTable("preferences", {
  id: text("id").primaryKey().default("default"),
  profile: jsonb("profile").notNull(),
  notificationThreshold: text("notification_threshold").notNull().default("strong"),
  minRelevanceScore: real("min_relevance_score").notNull().default(0.55),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;
