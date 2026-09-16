import { notFound } from "next/navigation";
import { getJobById } from "@/lib/db/queries";
import { JobActions } from "@/components/job-actions";
import { VisaBadges } from "@/components/visa-badges";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobById(id).catch(() => null);

  if (!job) notFound();

  const analysis = job.analysis as Record<string, unknown> | null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-white">{job.title}</h1>
        <p className="mt-2 text-zinc-400">
          {job.companyName} · {job.locations.join(", ") || "Location not specified"}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Remote: {job.remoteRegions.join(", ") || "Unknown"} · {job.remoteType}
        </p>
      </div>

      <VisaBadges job={job} />

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm capitalize text-zinc-300">
          {job.relevanceTier}
        </span>
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
          Score {(job.relevanceScore * 100).toFixed(0)}%
        </span>
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
          {job.source}
        </span>
      </div>

      <JobActions jobId={job.id} status={job.status} />

      {job.matchReasons.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white">Why it matches</h2>
          <ul className="mt-2 list-disc pl-5 text-zinc-300">
            {job.matchReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {job.concerns.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-amber-400">Potential concerns</h2>
          <ul className="mt-2 list-disc pl-5 text-zinc-400">
            {job.concerns.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {analysis && (
        <section>
          <h2 className="text-lg font-semibold text-white">Analysis</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {Object.entries(analysis).map(([key, value]) => (
              <div key={key} className="rounded bg-zinc-900 p-2">
                <dt className="text-zinc-500">{key}</dt>
                <dd className="text-zinc-200">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-white">Description</h2>
        <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-300 whitespace-pre-wrap">
          {job.description.slice(0, 8000)}
        </div>
      </section>

      <a
        href={job.canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-500"
      >
        Apply on company site
      </a>
    </div>
  );
}
