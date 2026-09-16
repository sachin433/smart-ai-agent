import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { jobs, jobEvents } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/auth/session";
import { randomId } from "@/lib/utils/hash";

const ACTION_STATUS: Record<string, string> = {
  save: "saved",
  reject: "rejected",
  interested: "matched",
  applied: "applied",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const action = body.action as string;
  const reason = body.reason as string | undefined;

  const status = ACTION_STATUS[action];
  if (!status) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(jobs)
    .set({ status: status as typeof jobs.$inferInsert.status, updatedAt: new Date() })
    .where(eq(jobs.id, id));

  await db.insert(jobEvents).values({
    id: randomId(),
    jobId: id,
    eventType: action,
    metadata: reason ? { reason } : undefined,
  });

  return NextResponse.json({ ok: true });
}
