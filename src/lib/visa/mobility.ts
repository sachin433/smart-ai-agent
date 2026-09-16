import type { CompanyMobilityProfile, SponsorCapability, VisaImmigrationStatus } from "./types";

import mobilityData from "@/data/company-mobility.json";

const profiles = mobilityData as CompanyMobilityProfile[];

const byId = new Map(profiles.map((p) => [p.companyId, p]));

export function getCompanyMobility(
  companyId?: string,
  companyName?: string,
): CompanyMobilityProfile | undefined {
  if (companyId && byId.has(companyId)) {
    return byId.get(companyId);
  }

  if (companyName) {
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (byId.has(slug)) return byId.get(slug);

    const compact = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [id, profile] of byId) {
      if (id.replace(/-/g, "") === compact || compact.includes(id.replace(/-/g, ""))) {
        return profile;
      }
    }
  }

  return undefined;
}

export function isKnownSponsorCapability(capability: SponsorCapability): boolean {
  return (
    capability === "known_sponsor" ||
    capability === "international_hiring_program"
  );
}

export function isLikelySponsorCapability(capability: SponsorCapability): boolean {
  return (
    isKnownSponsorCapability(capability) || capability === "likely_capable"
  );
}

/** Company-level sponsor signal — never auto-set without curated data. */
export function applyCompanyMobilityToVisa(
  visaStatus: VisaImmigrationStatus,
  mobility?: CompanyMobilityProfile,
): VisaImmigrationStatus {
  if (visaStatus !== "unknown" || !mobility) return visaStatus;

  if (mobility.sponsorCapability === "known_no_sponsorship") {
    return "negative_work_authorization";
  }

  if (isKnownSponsorCapability(mobility.sponsorCapability)) {
    return "sponsor_likely";
  }

  return visaStatus;
}

export function getAllMobilityProfiles(): CompanyMobilityProfile[] {
  return profiles;
}
