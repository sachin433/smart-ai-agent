import { passesAggregatorPrefilter } from "@/lib/discovery/title-prefilter";
import type { JobSource, RawJob, SearchParams, SourceHealth } from "@/lib/types";
import { stripHtml } from "@/lib/utils/text";
import { fetchJson } from "./base";

interface RemoteOkJob {
  id: string;
  slug: string;
  position: string;
  company: string;
  description?: string;
  location?: string;
  tags?: string[];
  date?: string;
  url: string;
  apply_url?: string;
  salary_min?: number;
  salary_max?: number;
}

export class RemoteOkSource implements JobSource {
  name = "remoteok";
  accessMethod = "public_feed" as const;
  rateLimit = { requestsPerMinute: 4, concurrency: 1 };

  async search(_params: SearchParams): Promise<RawJob[]> {
    const data = await fetchJson<RemoteOkJob[]>("https://remoteok.com/api");
    const jobs = Array.isArray(data) ? data : [];

    return jobs
      .filter((job) => job.position && job.company)
      .filter((job) => passesAggregatorPrefilter(job.position, job.tags))
      .map((job) => this.toRawJob(job));
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

  private toRawJob(job: RemoteOkJob): RawJob {
    const locations = job.location ? [job.location, "Remote"] : ["Remote"];

    return {
      source: this.name,
      sourceJobId: String(job.id),
      url: job.apply_url ?? job.url,
      companyName: job.company,
      title: job.position.trim(),
      description: stripHtml(job.description ?? ""),
      locations,
      remoteHint: "Remote",
      postedAt: job.date ? new Date(job.date) : undefined,
      raw: job,
    };
  }
}
