import { getSourceHealth } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const sources = await getSourceHealth().catch(() => []);

  const knownSources = ["greenhouse", "lever", "ashby", "remotive"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Source health</h1>
        <p className="mt-1 text-zinc-400">
          Official ATS APIs only. No LinkedIn. No scraping.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Jobs found</th>
              <th className="px-4 py-3 text-left">Relevant</th>
              <th className="px-4 py-3 text-left">Last success</th>
            </tr>
          </thead>
          <tbody>
            {knownSources.map((name) => {
              const row = sources.find((s) => s.source === name);
              return (
                <tr key={name} className="border-t border-zinc-800">
                  <td className="px-4 py-3 text-white capitalize">{name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row?.status === "healthy"
                          ? "text-emerald-400"
                          : row?.status === "degraded"
                            ? "text-amber-400"
                            : "text-zinc-500"
                      }
                    >
                      {row?.status ?? "not scanned"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{row?.jobsFound ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-300">{row?.relevantJobs ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {row?.lastSuccessAt?.toLocaleString() ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
        <p className="font-medium text-zinc-300">Vercel Hobby constraints</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Cron runs once per day (not every 4 hours)</li>
          <li>Function timeout: 60 seconds — scans use chunked workers</li>
          <li>No paid AI or infra required</li>
        </ul>
      </div>
    </div>
  );
}
