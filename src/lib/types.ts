import type { ImmigrationPolicy } from "@/lib/visa/types";

export interface CandidateProfile {
  seniority: {
    preferred: string[];
    acceptable: string[];
  };
  coreRoles: string[];
  cloud: string[];
  platform: string[];
  ai: string[];
  observability: string[];
  preferredLocations: string[];
  preferredRemoteRegions: string[];
  negativeSignals: string[];
  searchTitles: string[];
  immigration?: ImmigrationPolicy;
}

export interface SearchParams {
  query?: string;
  companySlug?: string;
  companyName?: string;
  profile?: CandidateProfile;
}

export interface RawJob {
  source: string;
  sourceJobId: string;
  url: string;
  companyName: string;
  title: string;
  description: string;
  locations: string[];
  remoteHint?: string;
  employmentType?: string;
  postedAt?: Date;
  salaryText?: string;
  raw: unknown;
}

export interface SourceHealth {
  source: string;
  healthy: boolean;
  lastChecked: Date;
  jobsFound: number;
  error?: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  concurrency: number;
}

export interface JobSource {
  name: string;
  accessMethod: "official_api" | "public_feed";
  search(params: SearchParams): Promise<RawJob[]>;
  healthCheck(): Promise<SourceHealth>;
  rateLimit?: RateLimitConfig;
}

export interface JobAnalysis {
  seniority: string;
  staffEquivalent: boolean;
  staffConfidence: number;
  function: string;
  aiRelevance: "high" | "medium" | "low" | "none";
  cloud: string[];
  kubernetes: boolean;
  terraform: boolean;
  architecture: boolean;
  technicalLeadership: boolean;
  peopleManagement: boolean;
  distributedSystems: boolean;
  observability: boolean;
  gpu: boolean;
  inference: boolean;
  remoteScope: string;
  locationCategory?: string;
  visaSponsorship: "required" | "available" | "not_available" | "unknown";
  visaImmigrationStatus?: string;
  visaConfidence?: number;
  companySponsorCapability?: string;
}

export type RelevanceTier = "exceptional" | "strong" | "potential" | "low";

export interface ScoredJob {
  score: number;
  tier: RelevanceTier;
  reasons: string[];
  concerns: string[];
  analysis: JobAnalysis;
  rejected: boolean;
  rejectReason?: string;
}
