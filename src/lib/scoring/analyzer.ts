import type { CandidateProfile, JobAnalysis } from "@/lib/types";
import { classifyLocations } from "@/lib/location/classifier";
import { getTitleRejectReason } from "@/lib/scoring/role-filter";
import { containsPhrase, countPhraseMatches, normalizeTitle } from "@/lib/utils/text";
import {
  classifyVisaEligibility,
  toLegacyVisaSponsorship,
} from "@/lib/visa/classifier";
import { getCompanyMobility } from "@/lib/visa/mobility";

const STAFF_SIGNALS = [
  "architecture ownership",
  "cross-team",
  "technical strategy",
  "technical roadmap",
  "platform ownership",
  "infrastructure strategy",
  "system design",
  "organizational impact",
  "mentoring",
  "technical leadership",
  "rfc",
  "standards",
  "multi-region",
  "reliability strategy",
  "define the technical direction",
  "technical direction",
  "lead initiatives",
  "drive the roadmap",
];

const AI_SIGNALS = [
  "llm",
  "genai",
  "gpu",
  "cuda",
  "inference",
  "model serving",
  "model deployment",
  "ai platform",
  "ml platform",
  "mlops",
  "llmops",
  "distributed training",
  "ai compute",
  "gpu scheduling",
  "model observability",
  "ai observability",
  "vector database",
  "rag infrastructure",
  "ai infrastructure",
  "ml infrastructure",
];

const NEGATIVE_STRONG = [
  "junior",
  "entry level",
  "entry-level",
  "intern",
  "graduate",
  "frontend engineer",
  "front-end engineer",
  "mobile engineer",
  "ios engineer",
  "android engineer",
  "sales engineer",
  "support engineer",
  "helpdesk",
  "qa engineer",
  "quality assurance engineer",
  "test engineer",
  "react developer",
  "full-stack developer",
  "fullstack developer",
];

export interface AnalyzeOptions {
  companyId?: string;
  companyName?: string;
}

export function analyzeJob(
  title: string,
  description: string,
  locations: string[],
  _profile: CandidateProfile,
  options?: AnalyzeOptions,
): JobAnalysis {
  const text = `${title}\n${description}`.toLowerCase();
  const locationInfo = classifyLocations(locations);
  const visaText = `${title}\n${description}\n${locations.join(" ")}`;
  const visa = classifyVisaEligibility(visaText);

  const titleNorm = normalizeTitle(title);

  let seniority = "unknown";
  if (/\bprincipal\b/i.test(title)) seniority = "principal";
  else if (/\bstaff\b/i.test(title)) seniority = "staff";
  else if (/\blead\b/i.test(title)) seniority = "lead";
  else if (/\bsenior\b/i.test(title)) seniority = "senior";

  const staffSignalCount = countPhraseMatches(text, STAFF_SIGNALS);
  const hasStaffTitle = seniority === "staff" || seniority === "principal";
  const staffEquivalent =
    hasStaffTitle || (seniority === "senior" && staffSignalCount >= 3);
  const staffConfidence = Math.min(
    1,
    (hasStaffTitle ? 0.6 : 0) + staffSignalCount * 0.08,
  );

  const aiSignalCount = countPhraseMatches(text, AI_SIGNALS);
  let aiRelevance: JobAnalysis["aiRelevance"] = "none";
  if (aiSignalCount >= 4) aiRelevance = "high";
  else if (aiSignalCount >= 2) aiRelevance = "medium";
  else if (aiSignalCount >= 1) aiRelevance = "low";

  const cloud: string[] = [];
  if (/\baws\b|amazon web services/i.test(text)) cloud.push("AWS");
  if (/\bgcp\b|google cloud/i.test(text)) cloud.push("GCP");
  if (/\bazure\b/i.test(text)) cloud.push("Azure");
  if (/\boci\b|oracle cloud/i.test(text)) cloud.push("OCI");

  const functionMatch = detectFunction(titleNorm, text);
  const mobility = getCompanyMobility(options?.companyId, options?.companyName);

  return {
    seniority,
    staffEquivalent,
    staffConfidence,
    function: functionMatch,
    aiRelevance,
    cloud,
    kubernetes: /\bkubernetes\b|\bk8s\b/i.test(text),
    terraform: /\bterraform\b/i.test(text),
    architecture:
      /\barchitecture\b/i.test(text) || staffSignalCount >= 2,
    technicalLeadership:
      /\btechnical lead/i.test(text) ||
      /\btech lead/i.test(text) ||
      staffSignalCount >= 2,
    peopleManagement:
      /\bpeople management\b/i.test(text) ||
      /\bmanage a team\b/i.test(text) ||
      /\bdirect reports\b/i.test(text),
    distributedSystems: /\bdistributed systems?\b/i.test(text),
    observability:
      /\bopentelemetry\b/i.test(text) ||
      /\bobservability\b/i.test(text) ||
      /\bmonitoring\b/i.test(text),
    gpu: /\bgpu\b|\bcuda\b/i.test(text),
    inference: /\binference\b/i.test(text),
    remoteScope: locationInfo.remoteScope,
    locationCategory: locationInfo.locationCategory,
    visaSponsorship: toLegacyVisaSponsorship(visa.status),
    visaImmigrationStatus: visa.status,
    visaConfidence: visa.confidence,
    ...(mobility ? { companySponsorCapability: mobility.sponsorCapability } : {}),
  };
}

function detectFunction(title: string, text: string): string {
  if (/sre|site reliability/i.test(title) || /site reliability/i.test(text)) {
    return "sre";
  }
  if (/platform/i.test(title)) return "platform";
  if (/infrastructure|infra/i.test(title)) return "infrastructure";
  if (/devops/i.test(title)) return "devops";
  if (/cloud/i.test(title)) return "cloud";
  if (/production engineer/i.test(title)) return "production";
  return "other";
}

export function hasStrongNegativeSignals(
  title: string,
  description: string,
  profile: CandidateProfile,
  locations: string[] = [],
  options?: AnalyzeOptions,
): { rejected: boolean; reason?: string } {
  const titleReject = getTitleRejectReason(title);
  if (titleReject) {
    return { rejected: true, reason: titleReject };
  }

  const combined = `${title} ${description}`.toLowerCase();

  for (const neg of NEGATIVE_STRONG) {
    if (combined.includes(neg)) {
      const isInfraContext =
        combined.includes("infrastructure") ||
        combined.includes("platform") ||
        combined.includes("sre");
      if (neg.includes("frontend") || neg.includes("mobile")) {
        if (!isInfraContext) {
          return { rejected: true, reason: `Strong negative: ${neg}` };
        }
      } else {
        return { rejected: true, reason: `Strong negative: ${neg}` };
      }
    }
  }

  for (const neg of profile.negativeSignals) {
    if (containsPhrase(title, neg)) {
      const negLower = neg.toLowerCase();
      const isSeniorityOnly =
        negLower.includes("junior") ||
        negLower.includes("entry") ||
        negLower.includes("mid level");
      if (isSeniorityOnly && containsPhrase(title, "senior")) {
        continue;
      }
      return { rejected: true, reason: `Negative signal in title: ${neg}` };
    }
  }

  const resolvedLocations =
    locations.length > 0
      ? locations
      : description.match(/location[s]?:[^\n]+/gi)?.map((s) => s) ?? [];

  const locationInfo = classifyLocations(resolvedLocations);
  if (locationInfo.usOnly || !locationInfo.acceptable) {
    return {
      rejected: true,
      reason: locationInfo.usOnly
        ? "Location restriction not acceptable"
        : "Location not in target regions",
    };
  }

  const visaText = `${title}\n${description}\n${resolvedLocations.join(" ")}`;
  const visa = classifyVisaEligibility(visaText);

  if (visa.hardReject && profile.immigration?.rejectExistingWorkAuthorizationOnly !== false) {
    return {
      rejected: true,
      reason: `Work authorization restriction: ${visa.phrases[0] ?? visa.status}`,
    };
  }

  const mobility = getCompanyMobility(options?.companyId, options?.companyName);
  if (mobility?.sponsorCapability === "known_no_sponsorship") {
    return {
      rejected: true,
      reason: "Company known not to sponsor work authorization",
    };
  }

  return { rejected: false };
}
