const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "source",
  "campaign",
  "gh_jid",
  "lever-source",
]);

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";

    const params = new URLSearchParams(parsed.search);
    for (const key of [...params.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        params.delete(key);
      }
    }

    const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    parsed.search = sorted.length > 0 ? `?${new URLSearchParams(sorted).toString()}` : "";

    let path = parsed.pathname.replace(/\/+$/, "");
    if (!path) path = "/";
    parsed.pathname = path;

    return parsed.toString();
  } catch {
    return url.trim();
  }
}
