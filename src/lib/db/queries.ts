import { desc, eq, and, count } from "drizzle-orm";
import { getDb } from "./index";
import { jobs, scanRuns, sourceHealth } from "./schema";
import {
  buildJobsWhere,
  buildNewTodayCondition,
  type JobSqlFilters,
  type VisaFilterMode,
} from "./job-filters";

export interface JobQueryFilters {
  lane?: string;
  visa?: VisaFilterMode;
  status?: string;
  tier?: string;
  relocationLanesOnly?: boolean;
  limit?: number;
}

function toSqlFilters(filters: JobQueryFilters): JobSqlFilters {
  return {
    status: filters.status,
    tier: filters.tier,
    lane: filters.lane,
    visa: filters.visa,
    lanes: filters.relocationLanesOnly ? ["P0", "P1"] : undefined,
    excludeRejected: !filters.status,
  };
}

export async function queryJobs(filters: JobQueryFilters = {}) {
  const db = getDb();
  const where = buildJobsWhere(toSqlFilters(filters));

  let query = db.select().from(jobs).$dynamic();
  query = query.orderBy(desc(jobs.firstSeenAt));
  if (where) query = query.where(where);
  if (filters.limit !== undefined) query = query.limit(filters.limit);
  return query;
}

export async function getDashboardStats() {
  const db = getDb();
  const baseWhere = buildJobsWhere({ excludeRejected: true });
  const todayWhere = and(baseWhere, buildNewTodayCondition());

  const countWhere = async (extra?: JobSqlFilters) => {
    const w = buildJobsWhere({ excludeRejected: true, ...extra });
    const [row] = await db.select({ n: count() }).from(jobs).where(w);
    return row?.n ?? 0;
  };

  const [totalRow] = await db
    .select({ n: count() })
    .from(jobs)
    .where(baseWhere);

  const [newTodayRow] = await db
    .select({ n: count() })
    .from(jobs)
    .where(todayWhere!);

  return {
    total: totalRow?.n ?? 0,
    newToday: newTodayRow?.n ?? 0,
    exceptional: await countWhere({ tier: "exceptional" }),
    strong: await countWhere({ tier: "strong" }),
    saved: await countWhere({ status: "saved" }),
    applied: await countWhere({ status: "applied" }),
    p0: await countWhere({ lane: "P0" }),
    p1: await countWhere({ lane: "P1" }),
    p3: await countWhere({ lane: "P3" }),
  };
}

const RECENT_JOB_TIERS = ["exceptional", "strong", "potential"] as const;
const DEFAULT_RECENT_LANES = ["P0", "P1", "P3"] as const;

export async function getRecentJobs(limit = 10, includeIndia = true) {
  const db = getDb();
  const where = buildJobsWhere({
    excludeRejected: true,
    tiers: [...RECENT_JOB_TIERS],
    lanes: includeIndia ? [...DEFAULT_RECENT_LANES] : ["P0", "P1"],
  });

  return db
    .select()
    .from(jobs)
    .where(where)
    .orderBy(desc(jobs.firstSeenAt))
    .limit(limit);
}

export async function getJobsByStatus(filters: JobQueryFilters = {}) {
  return queryJobs(filters);
}

export async function getJobById(id: string) {
  const db = getDb();
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSourceHealth() {
  const db = getDb();
  return db.select().from(sourceHealth);
}

export async function getLatestScan() {
  const db = getDb();
  const rows = await db
    .select()
    .from(scanRuns)
    .orderBy(desc(scanRuns.startedAt))
    .limit(1);
  return rows[0] ?? null;
}
