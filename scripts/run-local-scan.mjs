/**
 * Run a full scan locally by chaining worker calls until complete.
 * Usage: npm run scan:local
 * Requires: dev server running on NEXT_PUBLIC_APP_URL (default localhost:3000)
 */

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET ?? "local-cron-secret";
const workerSecret = process.env.WORKER_SECRET ?? "local-worker-secret";

async function startScan() {
  const res = await fetch(`${baseUrl}/api/cron/scan`, {
    method: "GET",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.scanRunId;
}

async function runWorker(scanRunId) {
  const res = await fetch(`${baseUrl}/api/internal/worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scanRunId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function main() {
  console.log("Starting scan...");
  const scanRunId = await startScan();
  console.log(`Scan run: ${scanRunId}`);

  let done = false;
  let rounds = 0;
  const maxRounds = 120;

  while (!done && rounds < maxRounds) {
    rounds++;
    const result = await runWorker(scanRunId);
    console.log(`  Round ${rounds}: processed ${result.processed}, done=${result.done}`);
    done = result.done;
    if (result.errors?.length) {
      console.log(`  Errors: ${result.errors.slice(0, 2).join("; ")}`);
    }
  }

  if (!done) {
    console.log("Scan did not finish within max rounds — check server logs.");
    process.exit(1);
  }

  const jobsRes = await fetch(`${baseUrl}/api/jobs?limit=10`, {
    headers: { Cookie: "job_radar_session=authenticated" },
  });
  if (jobsRes.ok) {
    const { jobs } = await jobsRes.json();
    console.log(`\nMatched jobs in DB: ${jobs?.length ?? 0}`);
    for (const job of (jobs ?? []).slice(0, 5)) {
      console.log(`  - [${job.relevanceTier}] ${job.title} @ ${job.companyName}`);
    }
  }

  console.log("\nDone. Open http://localhost:3000 (password: localdev)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
