export type VisaImmigrationStatus =
  | "explicit_sponsorship"
  | "relocation_support"
  | "blue_card_eligible"
  | "sponsor_likely"
  | "unknown"
  | "negative_work_authorization"
  | "not_applicable";

export type PriorityLane = "P0" | "P1" | "P2" | "P3";

export type SponsorCapability =
  | "known_sponsor"
  | "international_hiring_program"
  | "likely_capable"
  | "unknown"
  | "unlikely"
  | "known_no_sponsorship";

export interface ImmigrationEvidence {
  status: VisaImmigrationStatus;
  confidence: number;
  phrases: string[];
  matchedText?: string;
  country?: string;
  permitRoute?: string;
  checkedAt: string;
}

export interface VisaClassification {
  status: VisaImmigrationStatus;
  confidence: number;
  phrases: string[];
  scoreAdjustment: number;
  hardReject: boolean;
  relocationSupported: boolean;
  workAuthorizationRequired: boolean;
}

export interface CompanyMobilityProfile {
  companyId: string;
  euHiringCountries: string[];
  hasEuEntity?: boolean;
  sponsorCapability: SponsorCapability;
  evidenceNotes?: string;
}

export interface ImmigrationPolicy {
  primaryObjective: string;
  preferredCountries: string[];
  secondaryCountries: string[];
  requireVisaSupport: boolean;
  preferExplicitVisaSupport: boolean;
  rejectExistingWorkAuthorizationOnly: boolean;
  acceptUnknownVisaStatusAtScore: number;
  acceptBareRemoteAtScore: number;
  companySponsorBonus: number;
  explicitVisaBonus: number;
  relocationBonus: number;
}
