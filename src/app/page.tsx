import { getDashboardStats, getRecentJobs, getLatestScan } from "@/lib/db/queries";
import { JobCard } from "@/components/job-card";
import { ScanButton } from "@/components/scan-button";
import { ScanDiagnostics } from "@/components/scan-diagnostics";
import type { FunnelStats } from "@/lib/pipeline/funnel";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let stats = {
    total: 0,
    newToday: 0,
    exceptional: 0,
    strong: 0,
    saved: 0,
    applied: 0,
    p0: 0,
    p1: 0,
    p3: 0,
  };
  let recentJobs: Awaited<ReturnType<typeof getRecentJobs>> = [];
  let latestScan: Awaited<ReturnType<typeof getLatestScan>> | null = null;
  let dbError: string | null = null;

  try {
    stats = await getDashboardStats();
    recentJobs = await getRecentJobs(8);
    latestScan = await getLatestScan();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Database not configured";
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-zinc-400">
            Rule-based matching · zero AI APIs · Vercel Hobby compatible
          </p>
        </div>
        <ScanButton />
      </div>

      {dbError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          Database not connected: {dbError}. Set <code className="text-amber-100">DATABASE_URL</code> and run{" "}
          <code className="text-amber-100">npm run db:push</code>.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "New today", value: stats.newToday },
          { label: "Exceptional", value: stats.exceptional },
          { label: "Strong", value: stats.strong },
          { label: "P0 EU visa", value: stats.p0 },
          { label: "P1 EU verify", value: stats.p1 },
          { label: "P3 India", value: stats.p3 },
          { label: "Total matched", value: stats.total },
          { label: "Saved", value: stats.saved },
          { label: "Applied", value: stats.applied },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center"
          >
            <div className="text-2xl font-bold text-white">{item.value}</div>
            <div className="text-xs text-zinc-500">{item.label}</div>
          </div>
        ))}
      </div>

      {latestScan && (
        <ScanDiagnostics
          funnel={latestScan.funnelStats as FunnelStats | null}
          status={latestScan.status}
          startedAt={latestScan.startedAt}
        />
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Recent matches (P0 · P1 · P3)</h2>
        {recentJobs.length === 0 ? (
          <p className="text-zinc-500">
            No matches yet. Run a scan or wait for the daily cron job.
          </p>
        ) : (
          <div className="space-y-4">
            {recentJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
