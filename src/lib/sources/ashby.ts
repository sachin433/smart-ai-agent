import type { JobSource, RawJob, SearchParams, SourceHealth } from "@/lib/types";
import { stripHtml } from "@/lib/utils/text";
import { DEFAULT_RATE_LIMIT, fetchJson } from "./base";

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location: string }[];
  employmentType?: string;
  isRemote?: boolean;
  workplaceType?: string;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
}

interface AshbyResponse {
  jobs: AshbyJob[];
}

export class AshbySource implements JobSource {
  name = "ashby";
  accessMethod = "official_api" as const;
  rateLimit = DEFAULT_RATE_LIMIT;

  async search(params: SearchParams): Promise<RawJob[]> {
    const slug = params.companySlug;
    if (!slug) return [];

    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
    const data = await fetchJson<AshbyResponse>(url);

    return (data.jobs ?? []).map((job) => this.toRawJob(job, params.companyName ?? slug));
  }

  async healthCheck(): Promise<SourceHealth> {
    try {
      const jobs = await this.search({ companySlug: "ramp", companyName: "Ramp" });
      return {
        source: this.name,
        healthy: true,
        lastChecked: new Date(),
        jobsFound: jobs.length,
      };
    } catch (err) {
      return {
        source: this.name,
        healthy: false,
        lastChecked: new Date(),
        jobsFound: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private toRawJob(job: AshbyJob, companyName: string): RawJob {
    const locations: string[] = [];
    if (job.location) locations.push(job.location.trim());
    for (const sec of job.secondaryLocations ?? []) {
      if (sec.location) locations.push(sec.location.trim());
    }

    const remoteHint = job.isRemote
      ? "remote"
      : job.workplaceType?.toLowerCase();

    return {
      source: this.name,
      sourceJobId: job.id,
      url: job.jobUrl ?? job.applyUrl ?? `https://jobs.ashbyhq.com/${companyName}/${job.id}`,
      companyName,
      title: job.title.trim(),
      description: job.descriptionHtml ? stripHtml(job.descriptionHtml) : "",
      locations,
      remoteHint,
      employmentType: job.employmentType,
      postedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
      raw: job,
    };
  }
}
