/**
 * Run scan in-process (no HTTP dev server required).
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ne } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

import { getDb } from "../src/lib/db";
import { jobs } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { scanRuns } from "../src/lib/db/schema";
import { funnelSummary, type FunnelStats } from "../src/lib/pipeline/funnel";
import { startScan } from "../src/lib/scan/orchestrator";
import { processScanTasks } from "../src/lib/scan/worker";

async function main() {
  const db = getDb();
  const scanId = await startScan(db);
  console.log(`Scan run: ${scanId}`);

  let done = false;
  let rounds = 0;
  const maxRounds = 150;

  while (!done && rounds < maxRounds) {
    rounds++;
    const result = await processScanTasks(db, scanId);
    console.log(
      `  Round ${rounds}: processed ${result.processed}, done=${result.done}`,
    );
    if (result.errors.length > 0) {
      console.log(`  Error: ${result.errors[0]}`);
    }
    done = result.done;
  }

  const run = await db
    .select()
    .from(scanRuns)
    .where(eq(scanRuns.id, scanId))
    .limit(1);

  if (run[0]?.funnelStats) {
    console.log(`\nFunnel: ${funnelSummary(run[0].funnelStats as FunnelStats)}`);
  }

  const active = await db.select().from(jobs).where(ne(jobs.status, "rejected"));
  const p3 = active.filter((j) => j.priorityLane === "P3");

  console.log(`\nActive jobs: ${active.length} (P3 India: ${p3.length})`);
  for (const job of active.slice(0, 12)) {
    console.log(`  [${job.priorityLane}] ${job.title} @ ${job.companyName}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
