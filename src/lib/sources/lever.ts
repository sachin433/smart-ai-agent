import type { JobSource, RawJob, SearchParams, SourceHealth } from "@/lib/types";
import { stripHtml } from "@/lib/utils/text";
import { DEFAULT_RATE_LIMIT, fetchJson } from "./base";

interface LeverJob {
  id: string;
  text: string;
  descriptionPlain?: string;
  description?: string;
  categories?: {
    location?: string;
    allLocations?: string[];
    commitment?: string;
    department?: string;
  };
  workplaceType?: string;
  createdAt?: number;
  hostedUrl?: string;
  applyUrl?: string;
}

export class LeverSource implements JobSource {
  name = "lever";
  accessMethod = "official_api" as const;
  rateLimit = DEFAULT_RATE_LIMIT;

  async search(params: SearchParams): Promise<RawJob[]> {
    const slug = params.companySlug;
    if (!slug) return [];

    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
    const data = await fetchJson<LeverJob[]>(url);

    if (!Array.isArray(data)) return [];

    return data.map((job) => this.toRawJob(job, params.companyName ?? slug));
  }

  async healthCheck(): Promise<SourceHealth> {
    try {
      const jobs = await this.search({ companySlug: "palantir", companyName: "Palantir" });
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

  private toRawJob(job: LeverJob, companyName: string): RawJob {
    const locations: string[] = [];
    if (job.categories?.location) locations.push(job.categories.location);
    for (const loc of job.categories?.allLocations ?? []) {
      locations.push(loc);
    }

    let description = job.descriptionPlain ?? "";
    if (!description && job.description) {
      description = stripHtml(job.description);
    }

    const remoteHint = job.workplaceType ?? job.categories?.location;

    return {
      source: this.name,
      sourceJobId: job.id,
      url: job.hostedUrl ?? job.applyUrl ?? `https://jobs.lever.co/${companyName}/${job.id}`,
      companyName,
      title: job.text.trim(),
      description,
      locations,
      remoteHint,
      employmentType: job.categories?.commitment,
      postedAt: job.createdAt ? new Date(job.createdAt) : undefined,
      raw: job,
    };
  }
}
