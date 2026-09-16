import type { VisaClassification, VisaImmigrationStatus } from "./types";

const POSITIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bvisa sponsorship\b/i, label: "visa sponsorship" },
  { pattern: /\bwork visa\b/i, label: "work visa" },
  { pattern: /\bvisa (?:and|&)? relocation\b/i, label: "visa and relocation" },
  { pattern: /\brelocation (?:support|package|assistance)\b/i, label: "relocation support" },
  { pattern: /\bimmigration support\b/i, label: "immigration support" },
  { pattern: /\bwork permit (?:support|assistance|provided)\b/i, label: "work permit support" },
  { pattern: /\bwe sponsor\b/i, label: "we sponsor" },
  { pattern: /\binternational candidates (?:are )?welcome\b/i, label: "international candidates welcome" },
  { pattern: /\beu blue card\b/i, label: "eu blue card" },
  { pattern: /\bhighly skilled migrant\b/i, label: "highly skilled migrant" },
  { pattern: /\bskilled worker visa\b/i, label: "skilled worker visa" },
  { pattern: /\bglobal mobility\b/i, label: "global mobility" },
  { pattern: /\bwill (?:provide|offer) (?:visa|work permit)\b/i, label: "will provide visa" },
  { pattern: /\bsponsorship (?:is )?available\b/i, label: "sponsorship available" },
];

const NEGATIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bmust (?:already )?have (?:the )?right to work\b/i, label: "must have right to work" },
  { pattern: /\bmust be (?:legally )?authorized to work\b/i, label: "must be authorized to work" },
  { pattern: /\bmust (?:have|possess).*(?:work authorization|right to work)/i, label: "work authorization required" },
  { pattern: /\bno visa sponsorship\b/i, label: "no visa sponsorship" },
  { pattern: /\bwe do not sponsor\b/i, label: "we do not sponsor" },
  { pattern: /\bdo not provide visa assistance\b/i, label: "do not provide visa assistance" },
  { pattern: /\bwe do not provide visa\b/i, label: "we do not provide visa" },
  { pattern: /\bno visa assistance\b/i, label: "no visa assistance" },
  { pattern: /\bwithout visa assistance\b/i, label: "without visa assistance" },
  { pattern: /\bvisa assistance (?:is )?not (?:provided|available)\b/i, label: "visa assistance not provided" },
  { pattern: /\bvisa sponsorship (?:is )?not available\b/i, label: "visa sponsorship not available" },
  { pattern: /\bunable to sponsor\b/i, label: "unable to sponsor" },
  { pattern: /\bcooperation model does not include\b/i, label: "contractor model without direct-hire benefits" },
  { pattern: /\bcannot (?:provide|offer) (?:visa|immigration) support\b/i, label: "cannot provide immigration support" },
  { pattern: /\bwe cannot provide immigration support\b/i, label: "no immigration support" },
  { pattern: /\bneed not apply.*sponsorship\b/i, label: "need not apply if sponsorship required" },
  { pattern: /\bvalid (?:eu|eea) work permit required\b/i, label: "EU/EEA work permit required" },
  { pattern: /\beu\/eea work authorization required\b/i, label: "EU/EEA work authorization required" },
  { pattern: /\b(?:eu|eea) (?:citizen|nationals?) (?:only|required)\b/i, label: "EU/EEA citizens only" },
  { pattern: /\bapplicants must (?:be|reside) (?:in|within)\b/i, label: "applicants must reside in country" },
  { pattern: /\bmust be located in\b/i, label: "must be located in" },
  { pattern: /\bwithout (?:the )?need for sponsorship\b/i, label: "without need for sponsorship (inverse)" },
];

const RELOCATION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\brelocation (?:support|package|assistance|benefits|offered|provided)\b/i, label: "relocation support" },
  { pattern: /\brelocation and visa\b/i, label: "relocation and visa" },
  { pattern: /\binternational relocation\b/i, label: "international relocation" },
  { pattern: /\brelocation budget\b/i, label: "relocation budget" },
  { pattern: /\bmoving (?:to|from)\b/i, label: "moving support" },
];

/** Marketplace disclaimers override client-specific visa/relocation mentions elsewhere in the text. */
const MARKETPLACE_NO_VISA_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bwe do not provide visa assistance\b/i, label: "we do not provide visa assistance" },
  { pattern: /\bdo not provide visa assistance\b/i, label: "do not provide visa assistance" },
  { pattern: /\bour cooperation model does not include\b/i, label: "cooperation model disclaimer" },
];

function matchPatterns(
  text: string,
  patterns: Array<{ pattern: RegExp; label: string }>,
): string[] {
  return patterns.filter((p) => p.pattern.test(text)).map((p) => p.label);
}

export function classifyVisaEligibility(text: string): VisaClassification {
  const negative = [
    ...matchPatterns(text, NEGATIVE_PATTERNS),
    ...matchPatterns(text, MARKETPLACE_NO_VISA_PATTERNS),
  ];

  if (negative.length > 0) {
    return {
      status: "negative_work_authorization",
      confidence: 0.98,
      phrases: negative,
      scoreAdjustment: -0.35,
      hardReject: true,
      relocationSupported: false,
      workAuthorizationRequired: true,
    };
  }

  const positive = matchPatterns(text, POSITIVE_PATTERNS);
  const relocation = matchPatterns(text, RELOCATION_PATTERNS);

  const hasExplicitSponsor = positive.some((p) =>
    /visa sponsorship|we sponsor|work visa|sponsorship available|will provide visa/i.test(p),
  );

  if (hasExplicitSponsor) {
    return {
      status: "explicit_sponsorship",
      confidence: 0.95,
      phrases: positive,
      scoreAdjustment: 0.12,
      hardReject: false,
      relocationSupported: relocation.length > 0,
      workAuthorizationRequired: false,
    };
  }

  const hasPermitRoute = positive.some((p) =>
    /blue card|highly skilled migrant|work permit|skilled worker visa/i.test(p),
  );

  if (hasPermitRoute) {
    return {
      status: "blue_card_eligible",
      confidence: 0.85,
      phrases: positive,
      scoreAdjustment: 0.09,
      hardReject: false,
      relocationSupported: relocation.length > 0,
      workAuthorizationRequired: false,
    };
  }

  if (relocation.length > 0 || positive.some((p) => /immigration support|global mobility/i.test(p))) {
    return {
      status: "relocation_support",
      confidence: 0.7,
      phrases: [...positive, ...relocation],
      scoreAdjustment: 0.06,
      hardReject: false,
      relocationSupported: true,
      workAuthorizationRequired: false,
    };
  }

  return {
    status: "unknown",
    confidence: 0.2,
    phrases: [],
    scoreAdjustment: 0,
    hardReject: false,
    relocationSupported: false,
    workAuthorizationRequired: false,
  };
}

export function isPositiveVisaStatus(status: VisaImmigrationStatus): boolean {
  return (
    status === "explicit_sponsorship" ||
    status === "relocation_support" ||
    status === "blue_card_eligible"
  );
}

/** Map to legacy DB enum for backward compatibility. */
export function toLegacyVisaSponsorship(
  status: VisaImmigrationStatus,
): "required" | "available" | "not_available" | "unknown" {
  switch (status) {
    case "explicit_sponsorship":
    case "relocation_support":
    case "blue_card_eligible":
    case "sponsor_likely":
      return "available";
    case "negative_work_authorization":
      return "not_available";
    default:
      return "unknown";
  }
}

export function buildImmigrationEvidence(
  visa: VisaClassification,
  country?: string,
): ImmigrationEvidence {
  return {
    status: visa.status,
    confidence: visa.confidence,
    phrases: visa.phrases,
    country,
    checkedAt: new Date().toISOString(),
  };
}
