import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth/session";
import { startScan } from "@/lib/scan/orchestrator";
import { processScanTasks, triggerWorkerContinuation } from "@/lib/scan/worker";

export const maxDuration = 60;

/** Manual scan trigger from dashboard (authenticated). */
export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const scanRunId = await startScan(db);
  const result = await processScanTasks(db, scanRunId);

  if (!result.done) {
    await triggerWorkerContinuation(scanRunId);
  }

  return NextResponse.json({
    scanRunId,
    processed: result.processed,
    done: result.done,
    message: result.done
      ? "Scan complete"
      : "Scan started — worker will continue processing",
  });
}
