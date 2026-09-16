import { passesAggregatorPrefilter } from "@/lib/discovery/title-prefilter";
import type { JobSource, RawJob, SearchParams, SourceHealth } from "@/lib/types";
import { stripHtml } from "@/lib/utils/text";
import { fetchJson } from "./base";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags?: string[];
  job_type?: string;
  candidate_required_location?: string;
  salary?: string;
  description: string;
  publication_date: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
  "job-count"?: number;
}

export class RemotiveSource implements JobSource {
  name = "remotive";
  accessMethod = "public_feed" as const;
  rateLimit = { requestsPerMinute: 2, concurrency: 1 };

  async search(_params: SearchParams): Promise<RawJob[]> {
    // Remotive documents search params but the feed is effectively full-list;
    // filter client-side after fetch (max 1-2 calls per day per their ToS).
    const url = "https://remotive.com/api/remote-jobs";
    const data = await fetchJson<RemotiveResponse>(url);

    return (data.jobs ?? [])
      .filter((job) => passesAggregatorPrefilter(job.title, job.tags))
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

  private toRawJob(job: RemotiveJob): RawJob {
    const locations: string[] = [];
    if (job.candidate_required_location) {
      locations.push(job.candidate_required_location);
    }
    locations.push("Remote");

    return {
      source: this.name,
      sourceJobId: String(job.id),
      url: job.url,
      companyName: job.company_name,
      title: job.title.trim(),
      description: stripHtml(job.description),
      locations,
      remoteHint: job.candidate_required_location ?? "Remote",
      employmentType: job.job_type,
      postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
      salaryText: job.salary,
      raw: job,
    };
  }
}
