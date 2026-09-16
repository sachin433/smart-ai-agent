import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth/session";
import { queryJobs } from "@/lib/db/queries";
import { parseVisaFilter } from "@/lib/db/job-filters";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tier = searchParams.get("tier") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const lane = searchParams.get("lane") ?? undefined;
  const visa = parseVisaFilter(searchParams.get("visa"));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  const jobsList = await queryJobs({
    tier,
    status,
    lane,
    visa,
    limit,
  });

  return NextResponse.json({ jobs: jobsList });
}
