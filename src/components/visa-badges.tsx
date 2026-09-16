import type { Job } from "@/lib/db/schema";
import { LANE_LABELS } from "@/lib/visa/lanes";

const LANE_STYLES: Record<string, string> = {
  P0: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  P1: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  P2: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  P3: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
};

const VISA_STYLES: Record<string, { label: string; className: string }> = {
  explicit_sponsorship: {
    label: "Visa sponsored",
    className: "bg-green-500/20 text-green-300 border-green-500/40",
  },
  blue_card_eligible: {
    label: "Permit route",
    className: "bg-green-500/20 text-green-300 border-green-500/40",
  },
  relocation_support: {
    label: "Relocation",
    className: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  },
  sponsor_likely: {
    label: "Sponsor-likely; verify",
    className: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  unknown: {
    label: "Visa: verify",
    className: "bg-zinc-500/20 text-zinc-400 border-zinc-600/40",
  },
  negative_work_authorization: {
    label: "Auth required",
    className: "bg-red-500/20 text-red-300 border-red-500/40",
  },
};

export function VisaBadges({ job }: { job: Job }) {
  const lane = job.priorityLane ?? "P1";
  const visaKey = job.visaImmigrationStatus ?? "unknown";
  const visa = VISA_STYLES[visaKey] ?? VISA_STYLES.unknown;
  const laneStyle = LANE_STYLES[lane] ?? LANE_STYLES.P1;

  return (
    <div className="flex flex-wrap gap-2">
      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${laneStyle}`}>
        {lane} · {LANE_LABELS[lane as keyof typeof LANE_LABELS] ?? lane}
      </span>
      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${visa.className}`}>
        {visa.label}
        {job.visaConfidence > 0 ? ` (${Math.round(job.visaConfidence * 100)}%)` : ""}
      </span>
      {job.countryCode && (
        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">
          {job.countryCode}
        </span>
      )}
    </div>
  );
}
