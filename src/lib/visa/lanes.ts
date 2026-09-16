import type { LocationClassification } from "@/lib/location/classifier";
import type { RelevanceTier } from "@/lib/types";
import { isPositiveVisaStatus } from "./classifier";
import type { VisaClassification, VisaImmigrationStatus } from "./types";
import {
  applyCompanyMobilityToVisa,
  getCompanyMobility,
  isKnownSponsorCapability,
  isLikelySponsorCapability,
} from "./mobility";
import type { CompanyMobilityProfile, PriorityLane } from "./types";

export interface LaneAssignment {
  lane: PriorityLane;
  effectiveVisaStatus: VisaImmigrationStatus;
  mobility?: CompanyMobilityProfile;
}

export function assignPriorityLane(
  locationInfo: LocationClassification,
  visa: VisaClassification,
  companyId?: string,
  companyName?: string,
): LaneAssignment {
  const mobility = getCompanyMobility(companyId, companyName);
  const effectiveStatus = applyCompanyMobilityToVisa(visa.status, mobility);

  if (locationInfo.locationCategory === "INDIA" && !locationInfo.inEu && !locationInfo.inUk) {
    return { lane: "P3", effectiveVisaStatus: effectiveStatus, mobility };
  }

  if (
    locationInfo.inUk ||
    locationInfo.locationCategory === "UK"
  ) {
    return { lane: "P2", effectiveVisaStatus: effectiveStatus, mobility };
  }

  if (locationInfo.inSwiss || locationInfo.locationCategory === "SWITZERLAND") {
    return { lane: "P2", effectiveVisaStatus: effectiveStatus, mobility };
  }

  if (locationInfo.inJapan || locationInfo.locationCategory === "JAPAN") {
    return { lane: "P2", effectiveVisaStatus: effectiveStatus, mobility };
  }

  if (locationInfo.locationCategory === "GLOBAL_NON_US") {
    return { lane: "P2", effectiveVisaStatus: effectiveStatus, mobility };
  }

  if (locationInfo.locationCategory === "REMOTE_GLOBAL") {
    return { lane: "P2", effectiveVisaStatus: effectiveStatus, mobility };
  }

  if (locationInfo.inEu || locationInfo.locationCategory === "EU_HIGH_PRIORITY" || locationInfo.locationCategory === "EU_SECONDARY" || locationInfo.locationCategory === "REMOTE_EU_SCOPED") {
    if (
      isPositiveVisaStatus(effectiveStatus) ||
      (mobility && isKnownSponsorCapability(mobility.sponsorCapability))
    ) {
      return { lane: "P0", effectiveVisaStatus: effectiveStatus, mobility };
    }

    if (mobility && isLikelySponsorCapability(mobility.sponsorCapability)) {
      return { lane: "P1", effectiveVisaStatus: effectiveStatus, mobility };
    }

    return { lane: "P1", effectiveVisaStatus: effectiveStatus, mobility };
  }

  if (locationInfo.inIndia) {
    return { lane: "P3", effectiveVisaStatus: effectiveStatus, mobility };
  }

  return { lane: "P1", effectiveVisaStatus: effectiveStatus, mobility };
}

export function getMinIngestScore(
  lane: PriorityLane,
  visaStatus: VisaClassification["status"],
): number {
  const positive = isPositiveVisaStatus(visaStatus) || visaStatus === "sponsor_likely";

  switch (lane) {
    case "P0":
      return positive ? 0.55 : 0.58;
    case "P1":
      return 0.62;
    case "P2":
      return isPositiveVisaStatus(visaStatus) ? 0.62 : 0.68;
    case "P3":
      return 0.58;
    default:
      return 0.58;
  }
}

export const REVIEW_MIN_SCORE = 0.5;

export function shouldReviewIngestJob(params: {
  rejected: boolean;
  passesTitleFilter: boolean;
  relevanceScore: number;
  relevanceTier: RelevanceTier;
  locationAcceptable: boolean;
}): { review: boolean; reason?: string } {
  if (params.rejected || !params.passesTitleFilter) {
    return { review: false };
  }
  if (params.locationAcceptable) {
    return { review: false };
  }
  if (params.relevanceTier === "low") {
    return { review: false };
  }
  if (params.relevanceScore < REVIEW_MIN_SCORE) {
    return { review: false };
  }
  return { review: true, reason: "Borderline location — manual review" };
}

export function shouldIngestJob(params: {
  rejected: boolean;
  passesTitleFilter: boolean;
  relevanceScore: number;
  relevanceTier: RelevanceTier;
  lane: PriorityLane;
  visaStatus: VisaImmigrationStatus;
  locationAcceptable: boolean;
}): { ingest: boolean; reason?: string } {
  if (params.rejected) {
    return { ingest: false, reason: "Rejected by filters" };
  }
  if (!params.passesTitleFilter) {
    return { ingest: false, reason: "Title filter" };
  }
  if (!params.locationAcceptable) {
    return { ingest: false, reason: "Location" };
  }
  if (params.relevanceTier === "low") {
    return { ingest: false, reason: "Low tier" };
  }

  const minScore = getMinIngestScore(params.lane, params.visaStatus);
  if (params.relevanceScore < minScore) {
    return { ingest: false, reason: `Below ${params.lane} threshold (${minScore})` };
  }

  return { ingest: true };
}

export const LANE_LABELS: Record<PriorityLane, string> = {
  P0: "EU visa-ready",
  P1: "EU sponsor-likely",
  P2: "Global non-US",
  P3: "India / Pune",
};
