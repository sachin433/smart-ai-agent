import { normalizeTitle } from "./text";

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function contentHash(params: {
  company: string;
  title: string;
  locations: string[];
  description: string;
}): Promise<string> {
  const normalized = [
    params.company.trim().toLowerCase(),
    normalizeTitle(params.title),
    params.locations.map((l) => l.trim().toLowerCase()).sort().join("|"),
    params.description.trim().toLowerCase().slice(0, 5000),
  ].join("::");
  return sha256(normalized);
}

export function randomId(): string {
  return crypto.randomUUID();
}
