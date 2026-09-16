import { fetchJson } from "@/lib/sources/base";

export type AtsType = "greenhouse" | "lever" | "ashby";

export interface AtsProbeResult {
  atsType: AtsType;
  atsSlug: string;
  jobCount: number;
}

const PROBE_ORDER: AtsType[] = ["greenhouse", "lever", "ashby"];

const ENDPOINTS: Record<AtsType, (slug: string) => string> = {
  greenhouse: (slug) =>
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`,
  lever: (slug) =>
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
  ashby: (slug) =>
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
};

export function countJobs(atsType: AtsType, data: unknown): number {
  if (atsType === "lever" && Array.isArray(data)) return data.length;
  if (data && typeof data === "object" && "jobs" in data) {
    const jobs = (data as { jobs?: unknown[] }).jobs;
    return Array.isArray(jobs) ? jobs.length : 0;
  }
  return 0;
}

export async function probeAtsSlug(slug: string): Promise<AtsProbeResult | null> {
  for (const atsType of PROBE_ORDER) {
    try {
      const data = await fetchJson<unknown>(ENDPOINTS[atsType](slug));
      const jobCount = countJobs(atsType, data);
      if (jobCount > 0) {
        return { atsType, atsSlug: slug, jobCount };
      }
    } catch {
      // try next ATS
    }
  }
  return null;
}

export async function discoverCompanyBoard(
  slugs: string[],
): Promise<AtsProbeResult | null> {
  const unique = [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))];
  for (const slug of unique) {
    const hit = await probeAtsSlug(slug);
    if (hit) return hit;
  }
  return null;
}

export function slugCandidatesFromId(id: string, extra?: string[]): string[] {
  const base = id.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const candidates = [id.trim().toLowerCase(), base];
  if (extra) candidates.push(...extra.map((s) => s.toLowerCase()));
  return [...new Set(candidates.filter(Boolean))];
}
