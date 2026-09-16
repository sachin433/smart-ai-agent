/**
 * Probe ATS boards for market-universe probe candidates and upsert into companies table.
 * Run: npx tsx scripts/discover-companies.ts
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

import { getDb } from "../src/lib/db";
import { companies } from "../src/lib/db/schema";
import {
  discoverCompanyBoard,
  slugCandidatesFromId,
} from "../src/lib/discovery/ats-probe";
import marketUniverse from "../src/data/market-universe.json";

const PROBE_DELAY_MS = 200;

async function main() {
  const db = getDb();
  let discovered = 0;
  let failed = 0;

  const confirmed = marketUniverse.confirmed as Array<{
    id: string;
    name: string;
    atsType: string;
    atsSlug: string;
  }>;

  for (const seed of confirmed) {
    await db
      .insert(companies)
      .values({ ...seed, enabled: true })
      .onConflictDoUpdate({
        target: companies.id,
        set: {
          name: seed.name,
          atsType: seed.atsType,
          atsSlug: seed.atsSlug,
          enabled: true,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`Seeded ${confirmed.length} confirmed companies.`);

  const probeList = marketUniverse.probe as Array<{
    id: string;
    name: string;
    slugs?: string[];
  }>;

  for (const candidate of probeList) {
    const slugs = slugCandidatesFromId(candidate.id, candidate.slugs);
    const hit = await discoverCompanyBoard(slugs);

    if (!hit) {
      failed++;
      console.log(`  ✗ ${candidate.name} — no public ATS board found`);
      await sleep(PROBE_DELAY_MS);
      continue;
    }

    await db
      .insert(companies)
      .values({
        id: candidate.id,
        name: candidate.name,
        atsType: hit.atsType,
        atsSlug: hit.atsSlug,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: companies.id,
        set: {
          atsType: hit.atsType,
          atsSlug: hit.atsSlug,
          enabled: true,
          updatedAt: new Date(),
        },
      });

    discovered++;
    console.log(
      `  ✓ ${candidate.name} → ${hit.atsType}/${hit.atsSlug} (${hit.jobCount} jobs)`,
    );
    await sleep(PROBE_DELAY_MS);
  }

  const total = await db.select().from(companies).where(eq(companies.enabled, true));
  console.log(`\nDone. Discovered ${discovered}, missed ${failed}. Enabled companies: ${total.length}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
