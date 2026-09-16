/**
 * Standalone scan — runs without Next.js dev server.
 * Used by local launchd/cron every 4 hours.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

config({ path: resolve(root, ".env.local") });
config({ path: resolve(root, ".env") });

import { getDb } from "../src/lib/db";
import { startScan } from "../src/lib/scan/orchestrator";
import { processScanTasks } from "../src/lib/scan/worker";
import { sendDigestIfNeeded } from "../src/lib/email/digest";

async function main() {
  const started = new Date().toISOString();
  console.log(`[${started}] Job Radar scan starting...`);

  const db = getDb();
  const scanRunId = await startScan(db);

  let done = false;
  let rounds = 0;
  const maxRounds = 50;

  while (!done && rounds < maxRounds) {
    rounds++;
    const result = await processScanTasks(db, scanRunId);
    done = result.done;
    if (result.processed > 0) {
      console.log(`  Round ${rounds}: processed ${result.processed} tasks`);
    }
    if (result.errors.length > 0) {
      console.warn(`  Errors: ${result.errors.slice(0, 3).join("; ")}`);
    }
  }

  if (!done) {
    console.error("Scan did not finish within max rounds");
    process.exit(1);
  }

  const digest = await sendDigestIfNeeded(db);
  if (digest.sent) {
    console.log(`[${new Date().toISOString()}] Email digest sent (${digest.count} jobs)`);
  } else {
    console.log(`[${new Date().toISOString()}] No email: ${digest.reason ?? "ok"}`);
  }

  console.log(`[${new Date().toISOString()}] Scan complete (${rounds} rounds)`);
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] Scan failed:`, err);
  process.exit(1);
});
