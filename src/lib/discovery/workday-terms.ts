import type { CandidateProfile } from "@/lib/types";

const EU_LOCATION_TERMS = [
  "Berlin",
  "Amsterdam",
  "London",
  "Dublin",
  "Stockholm",
  "Munich",
  "Paris",
  "Remote",
  "EMEA",
  "Europe",
];

const INDIA_LOCATION_TERMS = [
  "Pune",
  "Bangalore",
  "Bengaluru",
  "Hyderabad",
  "Mumbai",
  "India",
];

const CORE_ROLE_TERMS = [
  "site reliability engineer",
  "platform engineer",
  "infrastructure engineer",
  "devops engineer",
  "cloud engineer",
  "production engineer",
];

/** Build Workday searchText terms from profile + target geographies. */
export function buildWorkdaySearchTerms(profile: CandidateProfile): string[] {
  const terms = new Set<string>(CORE_ROLE_TERMS);

  for (const title of profile.searchTitles.slice(0, 12)) {
    if (title.length >= 8) terms.add(title);
  }

  for (const loc of profile.preferredLocations) {
    if (loc.length >= 3) terms.add(loc);
  }

  for (const loc of profile.immigration?.preferredCountries ?? []) {
    terms.add(loc);
  }

  for (const loc of EU_LOCATION_TERMS) terms.add(loc);
  for (const loc of INDIA_LOCATION_TERMS) terms.add(loc);

  return [...terms].slice(0, 28);
}
