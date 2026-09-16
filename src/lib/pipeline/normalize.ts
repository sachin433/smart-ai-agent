import type { RawJob } from "@/lib/types";
import type { CandidateProfile } from "@/lib/types";
import { classifyLocations } from "@/lib/location/classifier";
import { contentHash, randomId } from "@/lib/utils/hash";
import { normalizeTitle } from "@/lib/utils/text";
import { canonicalizeUrl } from "@/lib/utils/url";
import { scoreJob } from "@/lib/scoring/relevance";
import { evaluateTitleGate } from "@/lib/scoring/title-gate";
import {
  buildImmigrationEvidence,
  classifyVisaEligibility,
  toLegacyVisaSponsorship,
} from "@/lib/visa/classifier";
import { assignPriorityLane } from "@/lib/visa/lanes";
import type { ImmigrationEvidence, PriorityLane } from "@/lib/visa/types";

export interface NormalizedJobInput {
  raw: RawJob;
  companyId?: string;
  profile: CandidateProfile;
}

export interface NormalizedJobResult {
  id: string;
  source: string;
  sourceJobId: string;
  canonicalUrl: string;
  companyId?: string;
  companyName: string;
  title: string;
  normalizedTitle: string;
  description: string;
  locations: string[];
  normalizedLocations: string[];
  remoteType: "onsite" | "hybrid" | "remote" | "unknown";
  remoteRegions: string[];
  employmentType?: string;
  seniority?: string;
  visaSponsorship: "required" | "available" | "not_available" | "unknown";
  priorityLane: PriorityLane;
  visaImmigrationStatus: string;
  visaConfidence: number;
  visaEvidence: ImmigrationEvidence;
  countryCode?: string;
  relocationSupported: boolean;
  workAuthorizationRequired: boolean;
  postedAt?: Date;
  contentHash: string;
  relevanceScore: number;
  relevanceTier: "exceptional" | "strong" | "potential" | "low";
  analysis: Record<string, unknown>;
  matchReasons: string[];
  concerns: string[];
  rawPayload: unknown;
  passesTitleFilter: boolean;
  locationAcceptable: boolean;
  rejected: boolean;
  rejectReason?: string;
}

export async function normalizeJob(
  input: NormalizedJobInput,
): Promise<NormalizedJobResult> {
  const { raw, companyId, profile } = input;
  const canonicalUrl = canonicalizeUrl(raw.url);
  const normalizedTitle = normalizeTitle(raw.title);

  const locations = [...raw.locations];
  if (raw.remoteHint && !locations.some((l) => l.toLowerCase().includes("remote"))) {
    locations.push(raw.remoteHint);
  }

  const locationInfo = classifyLocations(locations);
  const visaText = `${raw.title}\n${raw.description}\n${locations.join(" ")}`;
  const visa = classifyVisaEligibility(visaText);
  const visaEvidence = buildImmigrationEvidence(visa, locationInfo.countryCode);

  const hash = await contentHash({
    company: raw.companyName,
    title: raw.title,
    locations,
    description: raw.description,
  });

  const scored = scoreJob(raw.title, raw.description, locations, profile, {
    companyId,
    companyName: raw.companyName,
  });

  const laneAssignment = assignPriorityLane(
    locationInfo,
    visa,
    companyId,
    raw.companyName,
  );

  const passesTitleFilter = evaluateTitleGate(raw.title, profile).accepted;

  const concerns = [...scored.concerns];
  if (visa.status === "unknown" && laneAssignment.lane === "P1") {
    concerns.push("Sponsor-likely; verify visa path before applying");
  }

  return {
    id: randomId(),
    source: raw.source,
    sourceJobId: raw.sourceJobId,
    canonicalUrl,
    companyId,
    companyName: raw.companyName,
    title: raw.title,
    normalizedTitle,
    description: raw.description,
    locations,
    normalizedLocations: locationInfo.normalizedLocations,
    remoteType: locationInfo.remoteType,
    remoteRegions: locationInfo.remoteRegions,
    employmentType: raw.employmentType,
    seniority: scored.analysis.seniority,
    visaSponsorship: toLegacyVisaSponsorship(laneAssignment.effectiveVisaStatus),
    priorityLane: laneAssignment.lane,
    visaImmigrationStatus: laneAssignment.effectiveVisaStatus,
    visaConfidence: visa.confidence,
    visaEvidence,
    countryCode: locationInfo.countryCode,
    relocationSupported: visa.relocationSupported,
    workAuthorizationRequired: visa.workAuthorizationRequired,
    postedAt: raw.postedAt,
    contentHash: hash,
    relevanceScore: scored.score,
    relevanceTier: scored.tier,
    analysis: scored.analysis as unknown as Record<string, unknown>,
    matchReasons: scored.reasons,
    concerns,
    rawPayload: raw.raw,
    passesTitleFilter,
    locationAcceptable: locationInfo.acceptable,
    rejected: scored.rejected,
    rejectReason: scored.rejectReason,
  };
}
