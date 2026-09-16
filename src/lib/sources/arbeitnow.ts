import { passesAggregatorPrefilter } from "@/lib/discovery/title-prefilter";
import type { JobSource, RawJob, SearchParams, SourceHealth } from "@/lib/types";
import { stripHtml } from "@/lib/utils/text";
import { fetchJson } from "./base";

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote: boolean | string;
  url: string;
  tags?: string[];
  location?: string;
  created_at?: string;
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links?: { next?: string | null };
  meta?: { current_page?: number };
}

/** Pages to fetch per scan — ~2k EU jobs, client-filtered to infra titles. */
const MAX_PAGES = 8;
const PAGE_DELAY_MS = 400;

export class ArbeitnowSource implements JobSource {
  name = "arbeitnow";
  accessMethod = "public_feed" as const;
  rateLimit = { requestsPerMinute: 30, concurrency: 1 };

  async search(_params: SearchParams): Promise<RawJob[]> {
    const rawJobs: RawJob[] = [];
    let page = 1;

    while (page <= MAX_PAGES) {
      const data = await fetchJson<ArbeitnowResponse>(
        `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
      );

      for (const job of data.data ?? []) {
        if (!passesAggregatorPrefilter(job.title, job.tags)) continue;
        rawJobs.push(this.toRawJob(job));
      }

      if (!data.links?.next || (data.data?.length ?? 0) === 0) break;
      page++;
      await sleep(PAGE_DELAY_MS);
    }

    return rawJobs;
  }

  async healthCheck(): Promise<SourceHealth> {
    try {
      const jobs = await this.search({});
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

  private toRawJob(job: ArbeitnowJob): RawJob {
    const locations: string[] = [];
    if (job.location) locations.push(job.location);
    if (job.remote === true || job.remote === "true") locations.push("Remote");

    return {
      source: this.name,
      sourceJobId: job.slug,
      url: job.url,
      companyName: job.company_name,
      title: job.title.trim(),
      description: stripHtml(job.description ?? ""),
      locations,
      remoteHint: job.remote ? "Remote" : job.location,
      postedAt: job.created_at ? new Date(job.created_at) : undefined,
      raw: job,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
