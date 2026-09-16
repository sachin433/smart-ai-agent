import { isInfraTargetRole } from "@/lib/scoring/role-filter";
import { isSecurityRole } from "@/lib/scoring/security-filter";

/** Fast title gate for aggregator feeds — avoids scoring thousands of irrelevant rows. */
const AGGREGATOR_TITLE_KEYWORDS =
  /\b(sre|site reliability|devops|platform engineer|infrastructure|cloud engineer|production engineer|reliability engineer|kubernetes|terraform|mlops|ml infrastructure|ai infrastructure|sysadmin|systems engineer)\b/i;

const AGGREGATOR_TAG_KEYWORDS = new Set([
  "devops",
  "sre",
  "sysadmin",
  "infrastructure",
  "kubernetes",
  "terraform",
  "platform",
  "cloud",
  "mlops",
  "reliability",
]);

export function isLikelyInfraJobTitle(title: string): boolean {
  if (/\bprincipal\b/i.test(title)) return false;
  if (/\bgpu\b/i.test(title)) return false;
  if (isSecurityRole(title)) return false;
  if (isInfraTargetRole(title)) return true;
  return AGGREGATOR_TITLE_KEYWORDS.test(title);
}

export function tagsSuggestInfra(tags: string[] | undefined): boolean {
  if (!tags?.length) return false;
  return tags.some((t) => AGGREGATOR_TAG_KEYWORDS.has(t.toLowerCase().trim()));
}

export function passesAggregatorPrefilter(
  title: string,
  tags?: string[],
): boolean {
  return isLikelyInfraJobTitle(title) || tagsSuggestInfra(tags);
}
