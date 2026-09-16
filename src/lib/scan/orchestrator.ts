import { eq, and, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  scanRuns,
  scanTasks,
  companies,
  sourceHealth,
  preferences,
} from "@/lib/db/schema";
import { DEFAULT_PROFILE } from "@/lib/defaults/profile";
import type { CandidateProfile } from "@/lib/types";
import { randomId } from "@/lib/utils/hash";
import { seedCompanies } from "@/lib/pipeline/ingest";
import marketUniverse from "@/data/market-universe.json";
import { AGGREGATOR_SOURCES } from "@/lib/sources";

export async function getOrCreatePreferences(db: Db): Promise<CandidateProfile> {
  const rows = await db.select().from(preferences).limit(1);
  if (rows.length === 0) {
    await db.insert(preferences).values({
      id: "default",
      profile: DEFAULT_PROFILE,
    });
    return DEFAULT_PROFILE;
  }
  return rows[0].profile as CandidateProfile;
}

export async function startScan(db: Db): Promise<string> {
  await seedCompanies(db);

  const scanId = randomId();
  await db.insert(scanRuns).values({
    id: scanId,
    status: "running",
  });

  const enabledCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.enabled, true));

  const companyList =
    enabledCompanies.length > 0
      ? enabledCompanies
      : marketUniverse.confirmed.map((s) => ({
          id: s.id,
          name: s.name,
          atsType: s.atsType,
          atsSlug: s.atsSlug,
          enabled: true,
        }));

  const tasks: Array<{ id: string; type: string; payload: Record<string, unknown> }> = [];

  for (const company of companyList) {
    tasks.push({
      id: randomId(),
      type: "company_scan",
      payload: {
        companyId: company.id,
        companyName: company.name,
        atsType: company.atsType,
        atsSlug: company.atsSlug,
      },
    });
  }

  for (const source of AGGREGATOR_SOURCES) {
    tasks.push({
      id: randomId(),
      type: "aggregator_scan",
      payload: { source },
    });
  }

  for (const task of tasks) {
    await db.insert(scanTasks).values({
      id: task.id,
      scanRunId: scanId,
      taskType: task.type,
      payload: task.payload,
      status: "pending",
    });
  }

  return scanId;
}

export async function claimNextTask(
  db: Db,
  scanRunId: string,
): Promise<typeof scanTasks.$inferSelect | null> {
  const pending = await db
    .select()
    .from(scanTasks)
    .where(
      and(
        eq(scanTasks.scanRunId, scanRunId),
        eq(scanTasks.status, "pending"),
      ),
    )
    .limit(1);

  if (pending.length === 0) return null;

  const task = pending[0];
  await db
    .update(scanTasks)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(scanTasks.id, task.id));

  return { ...task, status: "running" as const };
}

export async function completeTask(
  db: Db,
  taskId: string,
  error?: string,
): Promise<void> {
  await db
    .update(scanTasks)
    .set({
      status: error ? "failed" : "done",
      error,
      completedAt: new Date(),
    })
    .where(eq(scanTasks.id, taskId));
}

export async function finalizeScanIfDone(db: Db, scanRunId: string): Promise<boolean> {
  const remaining = await db
    .select({ count: sql<number>`count(*)` })
    .from(scanTasks)
    .where(
      and(
        eq(scanTasks.scanRunId, scanRunId),
        eq(scanTasks.status, "pending"),
      ),
    );

  const running = await db
    .select({ count: sql<number>`count(*)` })
    .from(scanTasks)
    .where(
      and(
        eq(scanTasks.scanRunId, scanRunId),
        eq(scanTasks.status, "running"),
      ),
    );

  if ((remaining[0]?.count ?? 0) > 0 || (running[0]?.count ?? 0) > 0) {
    return false;
  }

  const run = await db
    .select()
    .from(scanRuns)
    .where(eq(scanRuns.id, scanRunId))
    .limit(1);

  if (run[0]?.status === "completed") return true;

  await db
    .update(scanRuns)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(scanRuns.id, scanRunId));

  return true;
}

export async function updateSourceHealth(
  db: Db,
  source: string,
  success: boolean,
  jobsFound: number,
  relevantJobs: number,
  error?: string,
): Promise<void> {
  const now = new Date();
  const existing = await db
    .select()
    .from(sourceHealth)
    .where(eq(sourceHealth.source, source))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(sourceHealth).values({
      source,
      lastSuccessAt: success ? now : undefined,
      lastFailureAt: success ? undefined : now,
      lastError: error,
      jobsFound,
      relevantJobs,
      status: success ? "healthy" : "degraded",
      updatedAt: now,
    });
    return;
  }

  await db
    .update(sourceHealth)
    .set({
      lastSuccessAt: success ? now : existing[0].lastSuccessAt,
      lastFailureAt: success ? existing[0].lastFailureAt : now,
      lastError: error ?? existing[0].lastError,
      jobsFound: existing[0].jobsFound + jobsFound,
      relevantJobs: existing[0].relevantJobs + relevantJobs,
      status: success ? "healthy" : "degraded",
      updatedAt: now,
    })
    .where(eq(sourceHealth.source, source));
}

export async function hasPendingTasks(db: Db, scanRunId: string): Promise<boolean> {
  const pending = await db
    .select({ count: sql<number>`count(*)` })
    .from(scanTasks)
    .where(
      and(
        eq(scanTasks.scanRunId, scanRunId),
        eq(scanTasks.status, "pending"),
      ),
    );
  return (pending[0]?.count ?? 0) > 0;
}
