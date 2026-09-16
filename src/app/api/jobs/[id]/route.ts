import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { jobs, jobEvents } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const job = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (job.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const events = await db
    .select()
    .from(jobEvents)
    .where(eq(jobEvents.jobId, id));

  return NextResponse.json({ job: job[0], events });
}
