import { isSecurityRole } from "./security-filter";

/** Target infrastructure/platform/SRE role patterns in job titles. */
const INFRA_TITLE_PATTERNS = [
  /\bsre\b/i,
  /site reliability/i,
  /platform engineer/i,
  /platform architect/i,
  /infrastructure engineer/i,
  /infrastructure architect/i,
  /infra engineer/i,
  /devops engineer/i,
  /cloud engineer/i,
  /cloud architect/i,
  /production engineer/i,
  /reliability engineer/i,
  /ml infrastructure/i,
  /ai infrastructure/i,
  /ml platform engineer/i,
  /ai platform engineer/i,
  /gpu infrastructure/i,
  /inference infrastructure/i,
  /compute infrastructure/i,
  /llm infrastructure/i,
  /[-–,]\s*infrastructure\b/i,
  /\binfrastructure\s*[-–(]/i,
  /content intelligence infrastructure/i,
  /kubernetes/i,
  /technical lead.*(infrastructure|platform|sre|devops|cloud|reliability)/i,
  /(staff|principal|lead).*(infrastructure|platform|sre|devops|cloud|reliability)/i,
  /(infrastructure|platform|sre|devops|cloud|reliability).*(staff|principal|lead)/i,
];

/** Titles that should never match even if they mention "infrastructure" loosely. */
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

export function isInfraTargetRole(title: string): boolean {
  const t = title.trim();

  if (isSecurityRole(t)) {
    return false;
  }

  if (HARD_REJECT_TITLE_PATTERNS.some((p) => p.test(t))) {
    return false;
  }

  if (SOFTWARE_ENGINEER_PATTERN.test(t)) {
    return INFRA_TITLE_PATTERNS.some((p) => p.test(t));
  }

  return INFRA_TITLE_PATTERNS.some((p) => p.test(t));
}

export function getTitleRejectReason(title: string): string | null {
  const t = title.trim();

  if (isSecurityRole(t)) {
    return `Security-focused role excluded: ${title}`;
  }

  if (
    /\b(amer|usa|us only|united states)\b/i.test(t) &&
    !/\b(emea|europe|eu|uk|london|germany|ireland|sweden|spain|switzerland|japan)\b/i.test(t)
  ) {
    return "US/AMER-focused role title";
  }

  for (const pattern of HARD_REJECT_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      return `Title not in target roles: ${title}`;
    }
  }

  if (SOFTWARE_ENGINEER_PATTERN.test(title) && !isInfraTargetRole(title)) {
    return "Generic software engineer role (not infrastructure/platform)";
  }

  if (!isInfraTargetRole(title)) {
    return "Title does not match infrastructure/platform/SRE target roles";
  }

  return null;
}
