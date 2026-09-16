import type { RateLimitConfig } from "@/lib/types";

export async function fetchJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "User-Agent": "JobRadar/1.0 (personal job search; +https://github.com)",
      ...options?.headers,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json() as Promise<T>;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requestsPerMinute: 10,
  concurrency: 2,
};
