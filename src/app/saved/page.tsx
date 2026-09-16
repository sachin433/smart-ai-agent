import { getJobsByStatus } from "@/lib/db/queries";
import { JobCard } from "@/components/job-card";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const jobsList = await getJobsByStatus({ status: "saved" }).catch(() => []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Saved jobs</h1>
      {jobsList.length === 0 ? (
        <p className="text-zinc-500">No saved jobs yet.</p>
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
