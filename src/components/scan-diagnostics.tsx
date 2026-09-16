import type { FunnelStats } from "@/lib/pipeline/funnel";

interface ScanDiagnosticsProps {
  funnel: FunnelStats | null | undefined;
  status: string;
  startedAt: Date;
}

export function ScanDiagnostics({ funnel, status, startedAt }: ScanDiagnosticsProps) {
  if (!funnel) return null;

  const stages = [
    { label: "Discovered", value: funnel.discovered },
    { label: "Ingested", value: funnel.ingested },
    { label: "Review", value: funnel.reviewIngested },
    { label: "Scoring reject", value: funnel.scoringRejected },
    { label: "Title reject", value: funnel.titleRejected },
    { label: "Location reject", value: funnel.locationRejected },
    { label: "Ingest gate", value: funnel.ingestRejected },
    { label: "Duplicates", value: funnel.duplicates },
  ];

  const topReasons = Object.entries(funnel.rejectReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Scan diagnostics</h2>
        <span className="text-xs text-zinc-500">
          {status} · {startedAt.toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stages.map((stage) => (
          <div key={stage.label} className="rounded-lg bg-zinc-950/60 px-3 py-2">
            <div className="text-lg font-semibold text-white">{stage.value}</div>
            <div className="text-xs text-zinc-500">{stage.label}</div>
          </div>
        ))}
      </div>

      {topReasons.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-medium text-zinc-300">Top reject reasons</h3>
          <ul className="space-y-2 text-sm">
            {topReasons.map(([reason, count]) => (
              <li key={reason} className="flex items-start justify-between gap-4">
                <span className="text-zinc-400">{reason}</span>
                <span className="shrink-0 font-mono text-zinc-200">{count}</span>
              </li>
            ))}
          </ul>
          {Object.entries(funnel.samples).slice(0, 3).map(([reason, samples]) => (
            samples.length > 0 ? (
              <p key={reason} className="mt-2 text-xs text-zinc-600">
                {reason}: {samples.join(" · ")}
              </p>
            ) : null
          ))}
        </div>
      )}
    </section>
  );
}
