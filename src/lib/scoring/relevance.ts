import type { CandidateProfile, JobAnalysis, RelevanceTier, ScoredJob } from "@/lib/types";
import { classifyLocations } from "@/lib/location/classifier";
import { analyzeJob, hasStrongNegativeSignals, type AnalyzeOptions } from "./analyzer";
import { isInfraTargetRole } from "./role-filter";
import { isSecurityRole } from "./security-filter";
import { containsPhrase } from "@/lib/utils/text";
import {
  classifyVisaEligibility,
  isPositiveVisaStatus,
} from "@/lib/visa/classifier";
import { getCompanyMobility, isKnownSponsorCapability } from "@/lib/visa/mobility";

const WEIGHTS = {
  seniority: 0.18,
  role: 0.18,
  infrastructure: 0.14,
  ai: 0.14,
  technology: 0.1,
  location: 0.08,
  visa: 0.1,
  remote: 0.04,
  leadership: 0.04,
};

export interface ScoreJobOptions extends AnalyzeOptions {}

export function scoreJob(
  title: string,
  description: string,
  locations: string[],
  profile: CandidateProfile,
  options?: ScoreJobOptions,
): ScoredJob {
  const negative = hasStrongNegativeSignals(
    title,
    description,
    profile,
    locations,
    options,
  );
  const analysis = analyzeJob(title, description, locations, profile, options);
  const locationInfo = classifyLocations(locations);
  const visaText = `${title}\n${description}\n${locations.join(" ")}`;
  const visa = classifyVisaEligibility(visaText);
  const mobility = getCompanyMobility(options?.companyId, options?.companyName);
  const reasons: string[] = [];
  const concerns: string[] = [...locationInfo.concerns];

  if (negative.rejected) {
    return {
      score: 0,
      tier: "low",
      reasons: [],
      concerns: [negative.reason ?? "Rejected by negative signals"],
      analysis,
      rejected: true,
      rejectReason: negative.reason,
    };
  }

  let score = 0;

  const seniorityScore = scoreSeniority(title, analysis, profile, reasons);
  score += seniorityScore * WEIGHTS.seniority;

  const roleScore = scoreRole(title, analysis, profile, reasons);
  score += roleScore * WEIGHTS.role;

  const infraScore = scoreInfrastructure(analysis, reasons);
  score += infraScore * WEIGHTS.infrastructure;

  const aiScore = scoreAi(analysis, reasons);
  score += aiScore * WEIGHTS.ai;

  const techScore = scoreTechnology(analysis, profile, reasons);
  score += techScore * WEIGHTS.technology;

  const locScore = locationInfo.acceptable ? 1 : 0;
  if (locScore > 0 && locationInfo.remoteScope !== "unknown") {
    reasons.push(`Location/remote: ${locationInfo.remoteScope}`);
  } else if (locScore === 0) {
    concerns.push("Location may not match preferences");
  }
  score += locScore * WEIGHTS.location;

  const visaScore = scoreVisaFeasibility(visa, mobility, reasons, concerns);
  score += visaScore * WEIGHTS.visa;

  const remoteScore =
    locationInfo.remoteType === "remote" || locationInfo.remoteType === "hybrid"
      ? 1
      : locationInfo.acceptable
        ? 0.7
        : 0.3;
  score += remoteScore * WEIGHTS.remote;

  const leadershipScore =
    (analysis.architecture ? 0.5 : 0) +
    (analysis.technicalLeadership ? 0.3 : 0) +
    (analysis.staffEquivalent ? 0.2 : 0);
  if (analysis.staffEquivalent) reasons.push("Staff-level or staff-equivalent responsibilities");
  if (analysis.architecture) reasons.push("Architecture/infrastructure ownership");
  score += Math.min(1, leadershipScore) * WEIGHTS.leadership;

  const visaBonus = Math.min(0.1, Math.max(0, visa.scoreAdjustment));
  if (mobility && isKnownSponsorCapability(mobility.sponsorCapability)) {
    score += profile.immigration?.companySponsorBonus ?? 0.03;
    reasons.push("Employer likely supports international hiring");
  }
  score = Math.min(1, Math.max(0, score + visaBonus));

  if (analysis.peopleManagement) {
    concerns.push("May include people management");
  }
  if (visa.status === "unknown") {
    concerns.push("Visa: verify — not stated in listing");
  }

  const tier = scoreToTier(score);

  return {
    score,
    tier,
    reasons: reasons.slice(0, 8),
    concerns: concerns.slice(0, 6),
    analysis,
    rejected: false,
  };
}

function scoreVisaFeasibility(
  visa: ReturnType<typeof classifyVisaEligibility>,
  mobility: ReturnType<typeof getCompanyMobility>,
  reasons: string[],
  concerns: string[],
): number {
  switch (visa.status) {
    case "explicit_sponsorship":
      reasons.push("Explicit visa sponsorship");
      return 1;
    case "blue_card_eligible":
      reasons.push("Permit route mentioned (e.g. Blue Card)");
      return 0.85;
    case "relocation_support":
      reasons.push("Relocation support mentioned");
      return 0.7;
    case "sponsor_likely":
      reasons.push("Sponsor-likely (company profile)");
      return 0.6;
    case "unknown":
      if (mobility && isKnownSponsorCapability(mobility.sponsorCapability)) {
        return 0.5;
      }
      return 0.3;
    default:
      concerns.push("Work authorization may be restricted");
      return 0;
  }
}

function scoreSeniority(
  title: string,
  analysis: JobAnalysis,
  _profile: CandidateProfile,
  reasons: string[],
): number {
  if (analysis.seniority === "principal" || analysis.seniority === "staff") {
    reasons.push(`${analysis.seniority} level role`);
    return 1;
  }
  if (/\bstaff\b/i.test(title)) {
    reasons.push("Staff level role");
    return 1;
  }
  if (analysis.staffEquivalent) {
    reasons.push("Staff-equivalent senior role");
    return 0.85;
  }
  if (analysis.seniority === "senior") return 0.6;
  if (analysis.seniority === "lead") return 0.8;
  return 0.2;
}

function scoreRole(
  title: string,
  analysis: JobAnalysis,
  profile: CandidateProfile,
  reasons: string[],
): number {
  const titleLower = title.toLowerCase();
  let matches = 0;
  for (const role of profile.coreRoles) {
    if (titleLower.includes(role.toLowerCase())) {
      matches++;
      reasons.push(`Role match: ${role}`);
    }
  }
  if (analysis.function !== "other") {
    matches += 0.5;
  }
  return Math.min(1, matches / 2);
}

function scoreInfrastructure(analysis: JobAnalysis, reasons: string[]): number {
  let s = 0;
  if (["sre", "platform", "infrastructure", "devops", "cloud", "production"].includes(analysis.function)) {
    s += 0.5;
    reasons.push(`${analysis.function} engineering focus`);
  }
  if (analysis.distributedSystems) s += 0.25;
  if (analysis.kubernetes) s += 0.15;
  if (analysis.terraform) s += 0.1;
  return Math.min(1, s);
}

function scoreAi(analysis: JobAnalysis, reasons: string[]): number {
  switch (analysis.aiRelevance) {
    case "high":
      reasons.push("High AI infrastructure relevance");
      return 1;
    case "medium":
      reasons.push("AI/ML platform component");
      return 0.7;
    case "low":
      return 0.3;
    default:
      return 0;
  }
}

function scoreTechnology(
  analysis: JobAnalysis,
  profile: CandidateProfile,
  reasons: string[],
): number {
  let hits = 0;
  let total = 0;

  for (const c of profile.cloud) {
    total++;
    if (analysis.cloud.some((x) => x.toLowerCase() === c.toLowerCase())) {
      hits++;
      reasons.push(c);
    }
  }
  if (analysis.kubernetes) {
    hits++;
    reasons.push("Kubernetes");
  }
  if (analysis.terraform) {
    hits++;
    reasons.push("Terraform");
  }
  if (analysis.observability) {
    hits++;
    reasons.push("Observability");
  }

  total += 3;
  return Math.min(1, hits / Math.max(total, 1));
}

function scoreToTier(score: number): RelevanceTier {
  if (score >= 0.78) return "exceptional";
  if (score >= 0.65) return "strong";
  if (score >= 0.55) return "potential";
  return "low";
}

/** Default minimum score — lane-specific thresholds applied at ingest. */
export const MIN_INGEST_SCORE = 0.58;

export function tierMeetsThreshold(
  tier: RelevanceTier,
  threshold: string,
): boolean {
  const order: RelevanceTier[] = ["low", "potential", "strong", "exceptional"];
  const tierIdx = order.indexOf(tier);
  const thresholdIdx = order.indexOf(threshold as RelevanceTier);
  return tierIdx >= thresholdIdx;
}

export function titleMatchesSearchRings(
  title: string,
  profile: CandidateProfile,
): boolean {
  if (/\bprincipal\b/i.test(title)) return false;
  if (/\bgpu\b/i.test(title)) return false;
  if (isSecurityRole(title)) return false;

  if (isInfraTargetRole(title)) return true;

  const norm = title.toLowerCase();
  for (const t of profile.searchTitles) {
    if (norm.includes(t.toLowerCase())) return true;
  }

  const adjacent = [
    "production engineer",
    "reliability engineer",
    "infrastructure architect",
    "platform architect",
    "cloud architect",
    "senior staff",
    "software engineer, infrastructure",
    "software engineer (infrastructure)",
    "software engineer - infrastructure",
    "data platform",
    "events platform",
    "search platform",
    "developer platform",
  ];
  for (const t of adjacent) {
    if (norm.includes(t)) return true;
  }

  const emerging = [
    "ai compute",
    "inference platform",
    "model serving",
    "llmops",
    "mlops",
    "compute platform",
  ];
  for (const t of emerging) {
    if (norm.includes(t)) return true;
  }

  return false;
}

export { isPositiveVisaStatus };
