import { Suspense } from "react";
import { getJobsByStatus } from "@/lib/db/queries";
import { parseVisaFilter } from "@/lib/db/job-filters";
import { JobCard } from "@/components/job-card";
import { JobFilters } from "@/components/job-filters";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string; visa?: string }>;
}) {
  const params = await searchParams;
  let jobsList: Awaited<ReturnType<typeof getJobsByStatus>> = [];
  let error: string | null = null;

  try {
    jobsList = await getJobsByStatus({
      lane: params.lane,
      visa: parseVisaFilter(params.visa),
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Database error";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">All jobs</h1>
        <p className="mt-1 text-sm text-zinc-500">
          P0 = EU visa-ready · P1 = EU verify · P2 = global non-US · P3 = India
        </p>
      </div>

      <Suspense fallback={null}>
        <JobFilters />
      </Suspense>

      {error && <p className="text-amber-400">{error}</p>}
      {jobsList.length === 0 ? (
        <p className="text-zinc-500">No jobs found for this filter.</p>
      ) : (
        <div className="space-y-4">
          {jobsList.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
