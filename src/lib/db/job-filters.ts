import { and, eq, gte, inArray, ne, type SQL } from "drizzle-orm";
import { jobs, jobStatusEnum, relevanceTierEnum } from "./schema";

type JobStatus = (typeof jobStatusEnum.enumValues)[number];
type RelevanceTier = (typeof relevanceTierEnum.enumValues)[number];

/** Visa statuses shown under the "Sponsored" filter (positive allowlist). */
export const VISA_SPONSORED_STATUSES = [
  "explicit_sponsorship",
  "blue_card_eligible",
  "relocation_support",
] as const;

/** Visa statuses shown under the "Verify" filter (positive allowlist). */
export const VISA_VERIFY_STATUSES = ["unknown", "sponsor_likely"] as const;

export type VisaFilterMode = "sponsored" | "verify";

export function parseVisaFilter(value?: string | null): VisaFilterMode | undefined {
  if (value === "sponsored" || value === "verify") return value;
  return undefined;
}

export interface JobSqlFilters {
  status?: string;
  tier?: string;
  tiers?: string[];
  lane?: string;
  lanes?: string[];
  visa?: VisaFilterMode;
  /** When false and no status filter, excludes rejected jobs. Default true. */
  excludeRejected?: boolean;
}

export function buildJobsWhere(filters: JobSqlFilters = {}): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(jobs.status, filters.status as JobStatus));
  } else if (filters.excludeRejected !== false) {
    conditions.push(ne(jobs.status, "rejected"));
  }

  if (filters.tier) {
    conditions.push(eq(jobs.relevanceTier, filters.tier as RelevanceTier));
  }

  if (filters.tiers && filters.tiers.length > 0) {
    conditions.push(inArray(jobs.relevanceTier, filters.tiers as RelevanceTier[]));
  }

  if (filters.lane) {
    conditions.push(eq(jobs.priorityLane, filters.lane));
  }

  if (filters.lanes && filters.lanes.length > 0) {
    conditions.push(inArray(jobs.priorityLane, [...filters.lanes]));
  }

  if (filters.visa === "sponsored") {
    conditions.push(inArray(jobs.visaImmigrationStatus, [...VISA_SPONSORED_STATUSES]));
  } else if (filters.visa === "verify") {
    conditions.push(inArray(jobs.visaImmigrationStatus, [...VISA_VERIFY_STATUSES]));
  }

  if (conditions.length === 0) return undefined;
  return and(...conditions);
}

export function matchesVisaFilter(
  status: string,
  visa?: VisaFilterMode,
): boolean {
  if (!visa) return true;
  if (visa === "sponsored") {
    return (VISA_SPONSORED_STATUSES as readonly string[]).includes(status);
  }
  return (VISA_VERIFY_STATUSES as readonly string[]).includes(status);
}

/** For dashboard "new today" boundary. */
export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function buildNewTodayCondition(): SQL {
  return gte(jobs.firstSeenAt, startOfToday());
}
