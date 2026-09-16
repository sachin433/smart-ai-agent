import Link from "next/link";
import type { Job } from "@/lib/db/schema";
import { VisaBadges } from "@/components/visa-badges";

const TIER_STYLES: Record<string, string> = {
  exceptional: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  strong: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  potential: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

export function JobCard({ job }: { job: Job }) {
  const tierStyle = TIER_STYLES[job.relevanceTier] ?? TIER_STYLES.low;
  const location = job.locations.join(", ") || "Not specified";

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/jobs/${job.id}`} className="text-lg font-medium text-white hover:underline">
            {job.title}
          </Link>
          <p className="mt-1 text-sm text-zinc-400">
            {job.companyName} · {location}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${tierStyle}`}>
          {job.relevanceTier}
        </span>
      </div>

      <div className="mt-3">
        <VisaBadges job={job} />
      </div>

      {job.matchReasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {job.matchReasons.slice(0, 4).map((reason) => (
            <li
              key={reason}
              className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
            >
              {reason}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500">
        <span>{job.source}</span>
        <span>·</span>
        <span>Score {(job.relevanceScore * 100).toFixed(0)}%</span>
        <span>·</span>
        <a
          href={job.canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          Apply
        </a>
      </div>
    </article>
  );
}
