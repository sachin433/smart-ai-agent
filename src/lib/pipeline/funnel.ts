/** Per-scan ingest funnel — tracks where jobs die in the filter stack. */

export interface FunnelStats {
  discovered: number;
  scoringRejected: number;
  titleRejected: number;
  locationRejected: number;
  ingestRejected: number;
  reviewIngested: number;
  ingested: number;
  duplicates: number;
  updated: number;
  rejectReasons: Record<string, number>;
  samples: Record<string, string[]>;
}

const MAX_SAMPLES_PER_REASON = 3;

export function createEmptyFunnel(): FunnelStats {
  return {
    discovered: 0,
    scoringRejected: 0,
    titleRejected: 0,
    locationRejected: 0,
    ingestRejected: 0,
    reviewIngested: 0,
    ingested: 0,
    duplicates: 0,
    updated: 0,
    rejectReasons: {},
    samples: {},
  };
}

export function mergeFunnel(a: FunnelStats, b: FunnelStats): FunnelStats {
  const rejectReasons = { ...a.rejectReasons };
  for (const [key, count] of Object.entries(b.rejectReasons)) {
    rejectReasons[key] = (rejectReasons[key] ?? 0) + count;
  }

  const samples = { ...a.samples };
  for (const [key, list] of Object.entries(b.samples)) {
    const merged = [...(samples[key] ?? []), ...list];
    samples[key] = merged.slice(0, MAX_SAMPLES_PER_REASON);
  }

  return {
    discovered: a.discovered + b.discovered,
    scoringRejected: a.scoringRejected + b.scoringRejected,
    titleRejected: a.titleRejected + b.titleRejected,
    locationRejected: a.locationRejected + b.locationRejected,
    ingestRejected: a.ingestRejected + b.ingestRejected,
    reviewIngested: a.reviewIngested + b.reviewIngested,
    ingested: a.ingested + b.ingested,
    duplicates: a.duplicates + b.duplicates,
    updated: a.updated + b.updated,
    rejectReasons,
    samples,
  };
}

export function recordFunnelReject(
  funnel: FunnelStats,
  reason: string,
  sample?: string,
): void {
  funnel.rejectReasons[reason] = (funnel.rejectReasons[reason] ?? 0) + 1;
  if (!sample) return;

  const bucket = funnel.samples[reason] ?? [];
  if (bucket.length < MAX_SAMPLES_PER_REASON && !bucket.includes(sample)) {
    bucket.push(sample);
    funnel.samples[reason] = bucket;
  }
}

export function funnelSummary(funnel: FunnelStats): string {
  const topReasons = Object.entries(funnel.rejectReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([reason, count]) => `${reason}: ${count}`)
    .join("; ");

  return [
    `discovered=${funnel.discovered}`,
    `ingested=${funnel.ingested}`,
    `review=${funnel.reviewIngested}`,
    `scoring=${funnel.scoringRejected}`,
    `title=${funnel.titleRejected}`,
    `location=${funnel.locationRejected}`,
    `ingest_gate=${funnel.ingestRejected}`,
    `dup=${funnel.duplicates}`,
    topReasons ? `top: ${topReasons}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}
