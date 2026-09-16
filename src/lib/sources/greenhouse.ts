import type { JobSource, RawJob, SearchParams, SourceHealth } from "@/lib/types";
import { decodeGreenhouseContent, stripHtml } from "@/lib/utils/text";
import { DEFAULT_RATE_LIMIT, fetchJson } from "./base";

interface GreenhouseJob {
  id: number;
  title: string;
  location?: { name?: string };
  absolute_url: string;
  company_name?: string;
  content?: string;
  updated_at?: string;
  first_published?: string;
  departments?: { name: string }[];
  offices?: { name: string; location?: string }[];
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export class GreenhouseSource implements JobSource {
  name = "greenhouse";
  accessMethod = "official_api" as const;
  rateLimit = DEFAULT_RATE_LIMIT;

  async search(params: SearchParams): Promise<RawJob[]> {
    const slug = params.companySlug;
    if (!slug) return [];

    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
    const data = await fetchJson<GreenhouseResponse>(url);

    return (data.jobs ?? []).map((job) => this.toRawJob(job, params.companyName ?? slug));
  }

  async healthCheck(): Promise<SourceHealth> {
    try {
      const jobs = await this.search({ companySlug: "stripe", companyName: "Stripe" });
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

  private toRawJob(job: GreenhouseJob, companyName: string): RawJob {
    const locations: string[] = [];
    if (job.location?.name) locations.push(job.location.name);
    for (const office of job.offices ?? []) {
      if (office.name) locations.push(office.name);
      if (office.location) locations.push(office.location);
    }

    let description = "";
    if (job.content) {
      description = stripHtml(decodeGreenhouseContent(job.content));
    }

    return {
      source: this.name,
      sourceJobId: String(job.id),
      url: job.absolute_url,
      companyName: job.company_name ?? companyName,
      title: job.title.trim(),
      description,
      locations,
      postedAt: job.first_published ? new Date(job.first_published) : undefined,
      raw: job,
    };
  }
}
