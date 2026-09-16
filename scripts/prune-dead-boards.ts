/**
 * Probe enabled company boards and disable 404 / empty ATS slugs.
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

import { getDb } from "../src/lib/db";
import { companies } from "../src/lib/db/schema";
import { getSource } from "../src/lib/sources";
import { probeAtsSlug } from "../src/lib/discovery/ats-probe";
import workdayBoards from "../src/data/workday-boards.json";

async function probeWorkday(slug: string): Promise<boolean> {
  const board = (workdayBoards.boards as Record<string, { tenant: string; shard: string; site: string }>)[slug];
  if (!board) return false;

  const apiBase = `https://${board.tenant}.${board.shard}.myworkdayjobs.com/wday/cxs/${board.tenant}/${board.site}`;
  try {
    const response = await fetch(`${apiBase}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "engineer" }),
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const db = getDb();
  const rows = await db.select().from(companies).where(eq(companies.enabled, true));

  let disabled = 0;
  let healthy = 0;

  for (const company of rows) {
    let ok = false;

    if (company.atsType === "workday") {
      ok = await probeWorkday(company.atsSlug);
    } else if (["greenhouse", "lever", "ashby"].includes(company.atsType)) {
      const hit = await probeAtsSlug(company.atsSlug);
      ok = hit !== null;
    } else {
      const source = getSource(company.atsType);
      if (source) {
        try {
          const jobs = await source.search({
            companySlug: company.atsSlug,
            companyName: company.name,
          });
          ok = true;
          console.log(`  ${company.name}: ${jobs.length} jobs (${company.atsType})`);
        } catch {
          ok = false;
        }
      }
    }

    if (ok) {
      healthy++;
      continue;
    }

    await db
      .update(companies)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(companies.id, company.id));

    disabled++;
    console.log(`DISABLED ${company.name} (${company.atsType}/${company.atsSlug})`);
  }

  console.log(`\nHealthy: ${healthy} | Disabled: ${disabled}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
