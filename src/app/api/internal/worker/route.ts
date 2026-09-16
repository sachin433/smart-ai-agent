import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyWorkerAuth } from "@/lib/auth/session";
import { processScanTasks, triggerWorkerContinuation } from "@/lib/scan/worker";
import { sendDigestIfNeeded } from "@/lib/email/digest";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!verifyWorkerAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const scanRunId = body.scanRunId as string;

  if (!scanRunId) {
    return NextResponse.json({ error: "scanRunId required" }, { status: 400 });
  }

  const db = getDb();
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
