import {
  classifyVisaEligibility,
  toLegacyVisaSponsorship,
} from "@/lib/visa/classifier";

export type LocationCategory =
  | "EU_HIGH_PRIORITY"
  | "EU_SECONDARY"
  | "UK"
  | "SWITZERLAND"
  | "JAPAN"
  | "GLOBAL_NON_US"
  | "INDIA"
  | "REMOTE_EU_SCOPED"
  | "REMOTE_GLOBAL"
  | "REMOTE_UNKNOWN"
  | "US_ONLY"
  | "INELIGIBLE";

export interface LocationClassification {
  normalizedLocations: string[];
  remoteType: "onsite" | "hybrid" | "remote" | "unknown";
  remoteRegions: string[];
  remoteScope: string;
  locationCategory: LocationCategory;
  countryCode?: string;
  usOnly: boolean;
  indiaOnly: boolean;
  inEu: boolean;
  inUk: boolean;
  inSwiss: boolean;
  inJapan: boolean;
  inIndia: boolean;
  acceptable: boolean;
  concerns: string[];
}

const EU_HIGH_PRIORITY = [
  "germany",
  "netherlands",
  "ireland",
  "sweden",
  "denmark",
  "finland",
  "belgium",
  "portugal",
  "spain",
  "poland",
  "czech",
  "czechia",
  "munich",
  "berlin",
  "amsterdam",
  "dublin",
  "stockholm",
  "copenhagen",
  "helsinki",
  "madrid",
  "lisbon",
  "warsaw",
  "prague",
  "brussels",
];

const EU_SECONDARY = [
  "france",
  "norway",
  "austria",
  "italy",
  "luxembourg",
  "estonia",
  "paris",
  "vienna",
  "oslo",
  "tallinn",
  "europe",
  "eu",
  "emea",
];

const UK_MARKERS = [
  "uk",
  "united kingdom",
  "london",
  "england",
  "scotland",
  "wales",
  "manchester",
  "edinburgh",
  "birmingham",
];

const SWISS = ["switzerland", "swiss", "zurich", "geneva", "basel", "bern"];

const JAPAN = ["japan", "tokyo", "osaka", "kyoto", "yokohama"];

const GLOBAL_NON_US = [
  "singapore",
  "uae",
  "united arab emirates",
  "dubai",
  "abu dhabi",
  "canada",
  "toronto",
  "vancouver",
  "montreal",
  "australia",
  "sydney",
  "melbourne",
];

const PUNE = ["pune", "maharashtra"];
const INDIA_CITIES = [
  "bengaluru",
  "bangalore",
  "hyderabad",
  "gurgaon",
  "gurugram",
  "noida",
  "chennai",
  "mumbai",
  "delhi",
  "kolkata",
  "indore",
];

const COUNTRY_CODE_MAP: Array<{ markers: string[]; code: string }> = [
  { markers: ["germany", "berlin", "munich"], code: "DE" },
  { markers: ["netherlands", "amsterdam"], code: "NL" },
  { markers: ["ireland", "dublin"], code: "IE" },
  { markers: ["sweden", "stockholm"], code: "SE" },
  { markers: ["uk", "united kingdom", "london"], code: "GB" },
  { markers: ["switzerland", "zurich", "geneva"], code: "CH" },
  { markers: ["japan", "tokyo"], code: "JP" },
  { markers: ["india", "pune", ...INDIA_CITIES], code: "IN" },
  { markers: ["france", "paris"], code: "FR" },
  { markers: ["spain", "madrid"], code: "ES" },
  { markers: ["poland", "warsaw"], code: "PL" },
];

const INDIA_REMOTE_PATTERNS = [
  /remote\s*[-–]?\s*india/i,
  /india\s*remote/i,
  /india\s*only/i,
];

const US_ONLY_PATTERNS = [
  /remote\s*[-–]?\s*us\s*only/i,
  /\bus\s*only\b/i,
  /united states only/i,
  /must be located in the (united states|us|usa)/i,
  /united states \(remote\)/i,
  /usa \(remote\)/i,
  /us - remote/i,
  /remote - united states/i,
  /remote - amer\b/i,
  /\|\s*us\s*\|/i,
  /\bamer\b(?!\s*\/)/i,
];

const US_CITY_MARKERS = [
  "san francisco",
  "new york",
  "seattle",
  "bellevue",
  "washington,",
  "palo alto",
  "mountain view",
  "los angeles",
  "austin",
  "boston",
  "chicago",
  "denver",
  "atlanta",
];

const INDIA_ONLY_PATTERNS = [/india only/i, /remote\s*[-–]?\s*india/i];

const EU_REMOTE_PATTERNS = [
  /remote\s*[-–]?\s*(eu|europe|emea)/i,
  /remote\s*[-–]?\s*european/i,
  /europe\s*remote/i,
];

const WORLDWIDE_PATTERNS = [/worldwide/i, /anywhere/i, /global remote/i, /work from anywhere/i];

const JAPAN_REMOTE_PATTERNS = [/remote\s*[-–]?\s*japan/i, /japan\s*remote/i];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function includesRegion(text: string, regions: string[]): boolean {
  const lower = text.toLowerCase();
  return regions.some((r) => lower.includes(r));
}

function detectCountryCode(combined: string): string | undefined {
  for (const entry of COUNTRY_CODE_MAP) {
    if (includesRegion(combined, entry.markers)) return entry.code;
  }
  return undefined;
}

export function classifyLocations(locations: string[]): LocationClassification {
  const combined = locations.join(" ").toLowerCase();
  const concerns: string[] = [];
  const normalized: string[] = [];

  for (const loc of locations) {
    const l = loc.trim();
    if (l) normalized.push(l);
  }

  const usOnly = matchesAny(combined, US_ONLY_PATTERNS);
  const indiaOnly = matchesAny(combined, INDIA_ONLY_PATTERNS);

  let remoteType: LocationClassification["remoteType"] = "unknown";
  if (/remote|work from home|wfh|distributed/i.test(combined)) {
    remoteType = "remote";
  } else if (/hybrid/i.test(combined)) {
    remoteType = "hybrid";
  } else if (locations.length > 0 && !/remote/i.test(combined)) {
    remoteType = "onsite";
  }

  const remoteRegions: string[] = [];
  let remoteScope = "unknown";

  if (matchesAny(combined, WORLDWIDE_PATTERNS)) {
    remoteRegions.push("Worldwide");
    remoteScope = "Worldwide";
  }
  if (matchesAny(combined, EU_REMOTE_PATTERNS)) {
    remoteRegions.push("Europe");
    if (remoteScope === "unknown") remoteScope = "Europe";
  }
  if (includesRegion(combined, SWISS)) {
    remoteRegions.push("Switzerland");
    if (remoteScope === "unknown") remoteScope = "Switzerland";
  }
  if (matchesAny(combined, JAPAN_REMOTE_PATTERNS) || includesRegion(combined, JAPAN)) {
    remoteRegions.push("Japan");
    if (remoteScope === "unknown") remoteScope = "Japan";
  }
  if (includesRegion(combined, PUNE)) {
    remoteRegions.push("Pune");
    if (remoteScope === "unknown") remoteScope = "Pune";
  } else if (matchesAny(combined, INDIA_REMOTE_PATTERNS) || /\bindia\b/i.test(combined)) {
    remoteRegions.push("India");
    if (remoteScope === "unknown") remoteScope = "India";
  }
  if (usOnly) {
    remoteRegions.push("US only");
    remoteScope = "US only";
    concerns.push("US-only remote restriction");
  }

  const inEuHigh = includesRegion(combined, EU_HIGH_PRIORITY);
  const inEuSecondary = includesRegion(combined, EU_SECONDARY);
  const inEu = inEuHigh || inEuSecondary || remoteScope === "Europe";
  const inUk = includesRegion(combined, UK_MARKERS);
  const inSwiss = includesRegion(combined, SWISS);
  const inJapan = includesRegion(combined, JAPAN) || remoteScope === "Japan";
  const inPune = includesRegion(combined, PUNE);
  const inGlobalNonUs = includesRegion(combined, GLOBAL_NON_US);
  const inIndia =
    inPune ||
    indiaOnly ||
    /\bindia\b/i.test(combined) ||
    matchesAny(combined, INDIA_REMOTE_PATTERNS);

  if (inEu && !inUk) remoteRegions.push("Europe");
  if (inUk) remoteRegions.push("UK");

  const isRemote = remoteType === "remote" || remoteType === "hybrid";
  const usPrimary = isUsPrimaryLocation(combined, inEu, inUk, inSwiss, inJapan, inPune, inIndia);

  if (usPrimary && !inEu && !inUk && !inSwiss && !inJapan && !inPune && !inIndia) {
    concerns.push("US/AMER-primary location without EU/CH/JP/India option");
  }

  let locationCategory: LocationCategory = "INELIGIBLE";

  if (usOnly || usPrimary) {
    locationCategory = "US_ONLY";
  } else if (isRemote && remoteScope === "unknown" && !inEu && !inUk && !inSwiss && !inJapan && !inIndia) {
    locationCategory = "REMOTE_UNKNOWN";
    concerns.push("Remote eligibility unclear");
  } else if (inEuHigh) {
    locationCategory = "EU_HIGH_PRIORITY";
  } else if (inEuSecondary || (isRemote && remoteScope === "Europe")) {
    locationCategory = inEuHigh ? "EU_HIGH_PRIORITY" : "EU_SECONDARY";
    if (isRemote && remoteScope === "Europe") locationCategory = "REMOTE_EU_SCOPED";
  } else if (inUk) {
    locationCategory = "UK";
  } else if (inSwiss) {
    locationCategory = "SWITZERLAND";
  } else if (inJapan) {
    locationCategory = "JAPAN";
  } else if (inGlobalNonUs) {
    locationCategory = "GLOBAL_NON_US";
  } else if (remoteScope === "Worldwide") {
    locationCategory = "REMOTE_GLOBAL";
  } else if (inIndia) {
    locationCategory = "INDIA";
  } else if (inEu) {
    locationCategory = "EU_SECONDARY";
  }

  let acceptable = false;
  if (locationCategory === "US_ONLY") {
    acceptable = false;
  } else if (locationCategory === "REMOTE_UNKNOWN") {
    acceptable = false;
  } else if (
    inEu ||
    inUk ||
    inSwiss ||
    inJapan ||
    inPune ||
    inIndia ||
    inGlobalNonUs ||
    locationCategory === "REMOTE_EU_SCOPED" ||
    locationCategory === "REMOTE_GLOBAL"
  ) {
    acceptable = true;
  } else if (!isRemote && locations.length === 0) {
    concerns.push("Location not specified");
  }

  return {
    normalizedLocations: normalized,
    remoteType,
    remoteRegions: [...new Set(remoteRegions)],
    remoteScope,
    locationCategory,
    countryCode: detectCountryCode(combined),
    usOnly: usOnly || usPrimary,
    indiaOnly: indiaOnly && !inPune,
    inEu: inEu && !inUk,
    inUk,
    inSwiss,
    inJapan,
    inIndia,
    acceptable,
    concerns,
  };
}

function isUsPrimaryLocation(
  combined: string,
  inEu: boolean,
  inUk: boolean,
  inSwiss: boolean,
  inJapan: boolean,
  inPune: boolean,
  inIndia: boolean,
): boolean {
  if (inEu || inUk || inSwiss || inJapan || inPune || inIndia) return false;

  if (matchesAny(combined, US_ONLY_PATTERNS)) return true;

  const usCityHit = US_CITY_MARKERS.some((m) => combined.includes(m));
  const hasIntlOption =
    /(germany|ireland|spain|sweden|uk|london|europe|emea|netherlands|france|switzerland|japan|tokyo|pune|india|maharashtra|singapore|canada|australia)/i.test(
      combined,
    );

  return usCityHit && !hasIntlOption;
}

/** @deprecated Prefer classifyVisaEligibility — kept for legacy callers */
export function extractVisaSignals(description: string): {
  visaSponsorship: "required" | "available" | "not_available" | "unknown";
  concerns: string[];
} {
  const visa = classifyVisaEligibility(description);
  const concerns: string[] = [];

  if (visa.status === "negative_work_authorization") {
    concerns.push("Work authorization restriction stated");
  } else if (visa.workAuthorizationRequired) {
    concerns.push("Work authorization requirement stated");
  }

  if (visa.status === "explicit_sponsorship") {
    concerns.push("Explicit visa sponsorship mentioned");
  } else if (visa.status === "relocation_support") {
    concerns.push("Relocation support mentioned");
  }

  return {
    visaSponsorship: toLegacyVisaSponsorship(visa.status),
    concerns,
  };
}
