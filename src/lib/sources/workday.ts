import { buildWorkdaySearchTerms } from "@/lib/discovery/workday-terms";
import { passesAggregatorPrefilter } from "@/lib/discovery/title-prefilter";
import { DEFAULT_PROFILE } from "@/lib/defaults/profile";
import type { JobSource, RawJob, SearchParams, SourceHealth } from "@/lib/types";
import { stripHtml } from "@/lib/utils/text";
import workdayBoards from "@/data/workday-boards.json";

const PAGE_SIZE = 20;
const MAX_PAGES_PER_TERM = 4;

interface WorkdayBoardConfig {
  companyName: string;
  tenant: string;
  shard: string;
  site: string;
}

interface WorkdayListItem {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}

interface WorkdayListResponse {
  jobPostings?: WorkdayListItem[];
  total?: number;
}

interface WorkdayDetailResponse {
  jobPostingInfo?: {
    id?: string;
    title?: string;
    jobDescription?: string;
    location?: string;
    externalUrl?: string;
    jobReqId?: string;
    country?: { descriptor?: string };
    jobRequisitionLocation?: { descriptor?: string };
  };
}

export class WorkdaySource implements JobSource {
  name = "workday";
  accessMethod = "official_api" as const;
  rateLimit = { requestsPerMinute: 20, concurrency: 1 };

  async search(params: SearchParams): Promise<RawJob[]> {
    const boardId = params.companySlug;
    if (!boardId) return [];

    const boards = workdayBoards.boards as Record<string, WorkdayBoardConfig>;
    const board = boards[boardId];
    if (!board) return [];

    const profile = params.profile ?? DEFAULT_PROFILE;
    const searchTerms = buildWorkdaySearchTerms(profile);

    const apiBase = `https://${board.tenant}.${board.shard}.myworkdayjobs.com/wday/cxs/${board.tenant}/${board.site}`;
    const seen = new Set<string>();
    const listItems: WorkdayListItem[] = [];

    for (const term of searchTerms) {
      let offset = 0;
      for (let page = 0; page < MAX_PAGES_PER_TERM; page++) {
        const data = await this.postJobs(apiBase, term, offset);
        const batch = data.jobPostings ?? [];
        if (batch.length === 0) break;

        for (const item of batch) {
          if (!item.externalPath || seen.has(item.externalPath)) continue;
          if (!passesAggregatorPrefilter(item.title)) continue;
          seen.add(item.externalPath);
          listItems.push(item);
        }

        offset += PAGE_SIZE;
        if (batch.length < PAGE_SIZE) break;
        await sleep(250);
      }
      await sleep(200);
    }

    const rawJobs: RawJob[] = [];

    for (const item of listItems) {
      try {
        rawJobs.push(await this.fetchDetail(apiBase, board, item));
        await sleep(150);
      } catch {
        rawJobs.push(this.listItemToRawJob(board, item));
      }
    }

    return rawJobs;
  }

  async healthCheck(): Promise<SourceHealth> {
    try {
      const jobs = await this.search({ companySlug: "zalando" });
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

  private stableJobId(board: WorkdayBoardConfig, item: WorkdayListItem): string {
    const pathKey = item.externalPath.replace(/^\//, "").replace(/\//g, "-");
    return `${board.tenant}-${pathKey}`;
  }

  private async postJobs(
    apiBase: string,
    searchText: string,
    offset: number,
  ): Promise<WorkdayListResponse> {
    const response = await fetch(`${apiBase}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": "en-US",
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: PAGE_SIZE,
        offset,
        searchText,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Workday HTTP ${response.status} for ${apiBase}`);
    }

    return response.json() as Promise<WorkdayListResponse>;
  }

  private async fetchDetail(
    apiBase: string,
    board: WorkdayBoardConfig,
    item: WorkdayListItem,
  ): Promise<RawJob> {
    const response = await fetch(`${apiBase}${item.externalPath}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return this.listItemToRawJob(board, item);
    }

    const data = (await response.json()) as WorkdayDetailResponse;
    const info = data.jobPostingInfo;
    const locations: string[] = [];
    if (info?.location) locations.push(info.location);
    if (info?.jobRequisitionLocation?.descriptor) {
      locations.push(info.jobRequisitionLocation.descriptor);
    }
    if (info?.country?.descriptor) locations.push(info.country.descriptor);
    if (item.locationsText) locations.push(item.locationsText);

    return {
      source: this.name,
      sourceJobId: this.stableJobId(board, item),
      url:
        info?.externalUrl ??
        `https://${board.tenant}.${board.shard}.myworkdayjobs.com${item.externalPath}`,
      companyName: board.companyName,
      title: (info?.title ?? item.title).trim(),
      description: stripHtml(info?.jobDescription ?? ""),
      locations,
      raw: { list: item, detail: data },
    };
  }

  private listItemToRawJob(
    board: WorkdayBoardConfig,
    item: WorkdayListItem,
  ): RawJob {
    return {
      source: this.name,
      sourceJobId: this.stableJobId(board, item),
      url: `https://${board.tenant}.${board.shard}.myworkdayjobs.com${item.externalPath}`,
      companyName: board.companyName,
      title: item.title.trim(),
      description: "",
      locations: item.locationsText ? [item.locationsText] : [],
      raw: item,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
