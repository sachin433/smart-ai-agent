import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyCronAuth } from "@/lib/auth/session";
import { startScan } from "@/lib/scan/orchestrator";
import { processScanTasks, triggerWorkerContinuation } from "@/lib/scan/worker";
import { sendDigestIfNeeded } from "@/lib/email/digest";

export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel Cron sends GET requests
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const scanRunId = await startScan(db);
  const result = await processScanTasks(db, scanRunId);

  if (!result.done) {
    await triggerWorkerContinuation(scanRunId);
  } else {
    await sendDigestIfNeeded(db);
  }

  return NextResponse.json({
    scanRunId,
    processed: result.processed,
    done: result.done,
    errors: result.errors,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
