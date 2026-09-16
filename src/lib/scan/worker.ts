import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { scanRuns } from "@/lib/db/schema";
import { ingestRawJobs } from "@/lib/pipeline/ingest";
import { getSource } from "@/lib/sources";
import {
  claimNextTask,
  completeTask,
  finalizeScanIfDone,
  getOrCreatePreferences,
  updateSourceHealth,
} from "./orchestrator";

const MAX_TASKS_PER_INVOCATION = 5;

export async function processScanTasks(
  db: Db,
  scanRunId: string,
): Promise<{ processed: number; done: boolean; errors: string[] }> {
  const profile = await getOrCreatePreferences(db);
  const errors: string[] = [];
  let processed = 0;

  for (let i = 0; i < MAX_TASKS_PER_INVOCATION; i++) {
    const task = await claimNextTask(db, scanRunId);
    if (!task) break;

    try {
      if (task.taskType === "company_scan") {
        const payload = task.payload as {
          companyId: string;
          companyName: string;
          atsType: string;
          atsSlug: string;
        };

        const source = getSource(payload.atsType);
        if (!source) {
          throw new Error(`Unknown ATS type: ${payload.atsType}`);
        }

        const rawJobs = await source.search({
          companySlug: payload.atsSlug,
          companyName: payload.companyName,
        });

        const result = await ingestRawJobs(
          db,
          rawJobs,
          profile,
          payload.companyId,
        );

        await updateSourceHealth(
          db,
          payload.atsType,
          true,
          result.discovered,
          result.relevant,
        );

        if (result.errors.length > 0) {
          errors.push(...result.errors.slice(0, 3));
        }
      } else if (task.taskType === "aggregator_scan") {
        const { source: sourceName } = task.payload as { source: string };
        const source = getSource(sourceName);
        if (!source) throw new Error(`Aggregator source not configured: ${sourceName}`);

        const rawJobs = await source.search({});
        const result = await ingestRawJobs(db, rawJobs, profile);

        await updateSourceHealth(
          db,
          sourceName,
          true,
          result.discovered,
          result.relevant,
        );
      } else if (task.taskType === "remotive_scan") {
        // Legacy task type from older scan runs
        const source = getSource("remotive");
        if (!source) throw new Error("Remotive source not configured");
        const rawJobs = await source.search({});
        const result = await ingestRawJobs(db, rawJobs, profile);
        await updateSourceHealth(db, "remotive", true, result.discovered, result.relevant);
      }

      await completeTask(db, task.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      const payload = task.payload as { atsType?: string };
      if (payload.atsType) {
        await updateSourceHealth(db, payload.atsType, false, 0, 0, message);
      }
      await completeTask(db, task.id, message);
      processed++;
    }
  }

  const done = await finalizeScanIfDone(db, scanRunId);

  if (done) {
    const run = await db
      .select()
      .from(scanRuns)
      .where(eq(scanRuns.id, scanRunId))
      .limit(1);

    if (run[0]) {
      await db
        .update(scanRuns)
        .set({
          errors: errors.length > 0 ? errors : run[0].errors,
        })
        .where(eq(scanRuns.id, scanRunId));
    }
  }

  return { processed, done, errors };
}

export async function triggerWorkerContinuation(
  scanRunId: string,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (!baseUrl) return;

  const url = baseUrl.startsWith("http")
    ? `${baseUrl}/api/internal/worker`
    : `https://${baseUrl}/api/internal/worker`;

  const secret = process.env.WORKER_SECRET;
  if (!secret) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ scanRunId }),
    });
  } catch {
    // Best-effort continuation; next cron or manual trigger will resume.
  }
}
