import type { CandidateProfile } from "@/lib/types";
import { isInfraTargetRole } from "./role-filter";
import { isSecurityRole } from "./security-filter";

const HARD_REJECT_TITLE_PATTERNS = [
  /\bqa engineer\b/i,
  /\bquality assurance\b/i,
  /\btest engineer\b/i,
  /\breact\b/i,
  /\bfull[- ]?stack\b/i,
  /\bfrontend\b/i,
  /\bfront[- ]end\b/i,
  /\bdata engineer\b/i,
  /\bapplied scientist\b/i,
  /\bproduct analyst\b/i,
  /\bprogram manager\b/i,
  /\baccounting\b/i,
  /\bbilling\b/i,
  /\border management\b/i,
  /\bmonetization\b/i,
  /\bcontent (platform|intelligence)\b/i,
  /\bbackend software engineer\b/i,
  /\belectrical engineer\b/i,
  /\bgeneralist\b/i,
  /\bsourcing\b/i,
  /\bmachine learning engineer\b/i,
  /\bml engineer\b/i,
];

const SOFTWARE_ENGINEER_PATTERN = /\bsoftware engineer\b/i;

const ADJACENT_TITLE_PHRASES = [
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

const EMERGING_TITLE_PHRASES = [
  "ai compute",
  "inference platform",
  "model serving",
  "llmops",
  "mlops",
  "compute platform",
];

export interface TitleGateResult {
  accepted: boolean;
  reason?: string;
}

/** Single authoritative title gate for scoring + ingest. */
export function evaluateTitleGate(
  title: string,
  profile: CandidateProfile,
): TitleGateResult {
  const t = title.trim();

  if (/\bprincipal\b/i.test(t)) {
    return { accepted: false, reason: "Principal titles excluded" };
  }
  if (/\bgpu\b/i.test(t)) {
    return { accepted: false, reason: "GPU titles excluded" };
  }
  if (isSecurityRole(t)) {
    return { accepted: false, reason: "Security-focused role excluded" };
  }
  if (
    /\b(amer|usa|us only|united states)\b/i.test(t) &&
    !/\b(emea|europe|eu|uk|london|germany|ireland|sweden|spain|switzerland|japan|india|pune|bangalore)\b/i.test(
      t,
    )
  ) {
    return { accepted: false, reason: "US/AMER-focused role title" };
  }

  for (const pattern of HARD_REJECT_TITLE_PATTERNS) {
    if (pattern.test(t)) {
      return { accepted: false, reason: `Title not in target roles: ${title}` };
    }
  }

  if (SOFTWARE_ENGINEER_PATTERN.test(t) && !isInfraTargetRole(t)) {
    return {
      accepted: false,
      reason: "Generic software engineer role (not infrastructure/platform)",
    };
  }

  if (isInfraTargetRole(t)) {
    return { accepted: true };
  }

  const norm = t.toLowerCase();
  for (const searchTitle of profile.searchTitles) {
    if (norm.includes(searchTitle.toLowerCase())) {
      return { accepted: true };
    }
  }

  for (const phrase of [...ADJACENT_TITLE_PHRASES, ...EMERGING_TITLE_PHRASES]) {
    if (norm.includes(phrase)) {
      return { accepted: true };
    }
  }

  return {
    accepted: false,
    reason: "Title does not match infrastructure/platform/SRE target roles",
  };
}

/** @deprecated Use evaluateTitleGate — kept for call sites that only need a reject reason string. */
export function getTitleRejectReason(
  title: string,
  profile: CandidateProfile,
): string | null {
  const result = evaluateTitleGate(title, profile);
  return result.accepted ? null : result.reason ?? "Title rejected";
}

/** @deprecated Use evaluateTitleGate */
export function titleMatchesSearchRings(
  title: string,
  profile: CandidateProfile,
): boolean {
  return evaluateTitleGate(title, profile).accepted;
}
