/**
 * Re-score all jobs in DB with current filters; mark irrelevant ones as rejected.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { eq } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

import { getDb } from "../src/lib/db";
import { jobs, preferences } from "../src/lib/db/schema";
import { DEFAULT_PROFILE } from "../src/lib/defaults/profile";
import { scoreJob, titleMatchesSearchRings } from "../src/lib/scoring/relevance";
import { classifyLocations } from "../src/lib/location/classifier";
import { getTitleRejectReason } from "../src/lib/scoring/role-filter";
import {
  assignPriorityLane,
  shouldIngestJob,
} from "../src/lib/visa/lanes";
import {
  buildImmigrationEvidence,
  classifyVisaEligibility,
  toLegacyVisaSponsorship,
} from "../src/lib/visa/classifier";
async function main() {
  const db = getDb();

  await db
    .insert(preferences)
    .values({
      id: "default",
      profile: DEFAULT_PROFILE,
      notificationThreshold: "strong",
      minRelevanceScore: 0.65,
    })
    .onConflictDoUpdate({
      target: preferences.id,
      set: {
        profile: DEFAULT_PROFILE,
        notificationThreshold: "strong",
        minRelevanceScore: 0.65,
        updatedAt: new Date(),
      },
    });

  const all = await db.select().from(jobs);
  let kept = 0;
  let rejected = 0;

  for (const job of all) {
    const locations = (job.locations as string[]) ?? [];
    const titleReject = getTitleRejectReason(job.title);
    const passesTitle = titleMatchesSearchRings(job.title, DEFAULT_PROFILE);
    const scored = scoreJob(job.title, job.description, locations, DEFAULT_PROFILE, {
      companyId: job.companyId ?? undefined,
      companyName: job.companyName,
    });
    const loc = classifyLocations(locations);
    const visaText = `${job.title}\n${job.description}\n${locations.join(" ")}`;
    const visa = classifyVisaEligibility(visaText);
    const laneAssignment = assignPriorityLane(
      loc,
      visa,
      job.companyId ?? undefined,
      job.companyName,
    );

    const ingestDecision = shouldIngestJob({
      rejected: !!titleReject || scored.rejected,
      passesTitleFilter: passesTitle,
      relevanceScore: scored.score,
      relevanceTier: scored.tier,
      lane: laneAssignment.lane,
      visaStatus: laneAssignment.effectiveVisaStatus,
      locationAcceptable: loc.acceptable,
    });

    const shouldKeep = ingestDecision.ingest;

    if (shouldKeep) {
      await db
        .update(jobs)
        .set({
          relevanceScore: scored.score,
          relevanceTier: scored.tier,
          analysis: scored.analysis as Record<string, unknown>,
          matchReasons: scored.reasons,
          concerns: scored.concerns,
          priorityLane: laneAssignment.lane,
          visaImmigrationStatus: laneAssignment.effectiveVisaStatus,
          visaConfidence: visa.confidence,
          visaEvidence: buildImmigrationEvidence(visa, loc.countryCode),
          countryCode: loc.countryCode,
          relocationSupported: visa.relocationSupported,
          workAuthorizationRequired: visa.workAuthorizationRequired,
          visaSponsorship: toLegacyVisaSponsorship(laneAssignment.effectiveVisaStatus),
          status: job.status === "rejected" ? "matched" : job.status,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));
      kept++;
    } else {
      const reason =
        titleReject ??
        scored.rejectReason ??
        ingestDecision.reason ??
        (!passesTitle ? "Title filter" : null) ??
        (!loc.acceptable ? "Location" : null) ??
        "Not relevant";

      await db
        .update(jobs)
        .set({
          status: "rejected",
          relevanceScore: scored.score,
          relevanceTier: scored.tier,
          priorityLane: laneAssignment.lane,
          visaImmigrationStatus: laneAssignment.effectiveVisaStatus,
          visaConfidence: visa.confidence,
          concerns: [...scored.concerns, reason],
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));
      rejected++;
      console.log(`  REJECT: ${job.title} @ ${job.companyName} — ${reason}`);
    }
  }

  console.log(`\nDone. Kept ${kept}, rejected ${rejected} of ${all.length} jobs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
