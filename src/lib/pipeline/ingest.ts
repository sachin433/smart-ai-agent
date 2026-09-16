import { eq, and, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { jobs, jobEvents, companies } from "@/lib/db/schema";
import type { CandidateProfile } from "@/lib/types";
import type { RawJob } from "@/lib/types";
import { normalizeJob } from "./normalize";
import { randomId } from "@/lib/utils/hash";
import { normalizeTitle } from "@/lib/utils/text";
import { shouldIngestJob, shouldReviewIngestJob } from "@/lib/visa/lanes";
import type { VisaImmigrationStatus } from "@/lib/visa/types";
import {
  createEmptyFunnel,
  recordFunnelReject,
  type FunnelStats,
} from "./funnel";

export interface IngestResult {
  discovered: number;
  newJobs: number;
  updated: number;
  duplicates: number;
  relevant: number;
  errors: string[];
  funnel: FunnelStats;
}

function batchDedupKey(companyName: string, title: string): string {
  return `${companyName.trim().toLowerCase()}|${normalizeTitle(title)}`;
}

export async function ingestRawJobs(
  db: Db,
  rawJobs: RawJob[],
  profile: CandidateProfile,
  companyId?: string,
): Promise<IngestResult> {
  const funnel = createEmptyFunnel();
  funnel.discovered = rawJobs.length;

  const result: IngestResult = {
    discovered: rawJobs.length,
    newJobs: 0,
    updated: 0,
    duplicates: 0,
    relevant: 0,
    errors: [],
    funnel,
  };

  const seenInBatch = new Set<string>();

  for (const raw of rawJobs) {
    try {
      const dedupKey = batchDedupKey(raw.companyName, raw.title);
      if (seenInBatch.has(dedupKey)) {
        funnel.duplicates++;
        result.duplicates++;
        continue;
      }

      const normalized = await normalizeJob({ raw, companyId, profile });
      const sample = `${normalized.title} @ ${normalized.companyName}`;

      if (normalized.rejected) {
        funnel.scoringRejected++;
        recordFunnelReject(
          funnel,
          normalized.rejectReason ?? "Scoring rejected",
          sample,
        );
        continue;
      }

      if (!normalized.passesTitleFilter) {
        funnel.titleRejected++;
        recordFunnelReject(funnel, "Title filter", sample);
        continue;
      }

      const reviewDecision = shouldReviewIngestJob({
        rejected: normalized.rejected,
        passesTitleFilter: normalized.passesTitleFilter,
        relevanceScore: normalized.relevanceScore,
        relevanceTier: normalized.relevanceTier,
        locationAcceptable: normalized.locationAcceptable,
      });

      const ingestDecision = shouldIngestJob({
        rejected: normalized.rejected,
        passesTitleFilter: normalized.passesTitleFilter,
        relevanceScore: normalized.relevanceScore,
        relevanceTier: normalized.relevanceTier,
        lane: normalized.priorityLane,
        visaStatus: normalized.visaImmigrationStatus as VisaImmigrationStatus,
        locationAcceptable: normalized.locationAcceptable,
      });

      if (!reviewDecision.review && !ingestDecision.ingest) {
        if (!normalized.locationAcceptable) {
          funnel.locationRejected++;
        } else {
          funnel.ingestRejected++;
        }
        recordFunnelReject(
          funnel,
          ingestDecision.reason ?? "Ingest gate",
          sample,
        );
        continue;
      }

      const existingBySource = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.source, normalized.source),
            eq(jobs.sourceJobId, normalized.sourceJobId),
          ),
        )
        .limit(1);

      const existingByUrl = await db
        .select()
        .from(jobs)
        .where(eq(jobs.canonicalUrl, normalized.canonicalUrl))
        .limit(1);

      const existingByHash = await db
        .select()
        .from(jobs)
        .where(eq(jobs.contentHash, normalized.contentHash))
        .limit(1);

      const existingByTitle = await db
        .select()
        .from(jobs)
        .where(
          and(
            sql`lower(${jobs.companyName}) = ${normalized.companyName.trim().toLowerCase()}`,
            eq(jobs.normalizedTitle, normalized.normalizedTitle),
          ),
        )
        .limit(1);

      const existing =
        existingBySource[0] ??
        existingByUrl[0] ??
        existingByHash[0] ??
        existingByTitle[0];

      const immigrationFields = {
        priorityLane: normalized.priorityLane,
        visaImmigrationStatus: normalized.visaImmigrationStatus,
        visaConfidence: normalized.visaConfidence,
        visaEvidence: normalized.visaEvidence,
        countryCode: normalized.countryCode,
        relocationSupported: normalized.relocationSupported,
        workAuthorizationRequired: normalized.workAuthorizationRequired,
      };

      if (existing) {
        seenInBatch.add(dedupKey);
        funnel.duplicates++;
        result.duplicates++;
        const contentChanged = existing.contentHash !== normalized.contentHash;

        await db
          .update(jobs)
          .set({
            lastSeenAt: new Date(),
            title: normalized.title,
            description: normalized.description,
            locations: normalized.locations,
            normalizedLocations: normalized.normalizedLocations,
            remoteType: normalized.remoteType,
            remoteRegions: normalized.remoteRegions,
            relevanceScore: normalized.relevanceScore,
            relevanceTier: normalized.relevanceTier,
            analysis: normalized.analysis,
            matchReasons: normalized.matchReasons,
            concerns: normalized.concerns,
            contentHash: normalized.contentHash,
            visaSponsorship: normalized.visaSponsorship,
            ...immigrationFields,
            updatedAt: new Date(),
            ...(contentChanged ? { status: "discovered" as const } : {}),
          })
          .where(eq(jobs.id, existing.id));

        if (contentChanged) {
          funnel.updated++;
          result.updated++;
          await db.insert(jobEvents).values({
            id: randomId(),
            jobId: existing.id,
            eventType: "updated",
            metadata: { previousHash: existing.contentHash },
          });
        }
        continue;
      }

      const isRelevant =
        normalized.relevanceTier === "exceptional" ||
        normalized.relevanceTier === "strong" ||
        normalized.relevanceTier === "potential";

      if (!isRelevant) {
        funnel.ingestRejected++;
        recordFunnelReject(funnel, "Low tier", sample);
        continue;
      }

      seenInBatch.add(dedupKey);
      result.relevant++;

      const jobStatus = reviewDecision.review ? "validated" : "matched";
      if (reviewDecision.review) {
        funnel.reviewIngested++;
      } else {
        funnel.ingested++;
      }

      await db.insert(jobs).values({
        id: normalized.id,
        source: normalized.source,
        sourceJobId: normalized.sourceJobId,
        canonicalUrl: normalized.canonicalUrl,
        companyId: normalized.companyId,
        companyName: normalized.companyName,
        title: normalized.title,
        normalizedTitle: normalized.normalizedTitle,
        description: normalized.description,
        locations: normalized.locations,
        normalizedLocations: normalized.normalizedLocations,
        remoteType: normalized.remoteType,
        remoteRegions: normalized.remoteRegions,
        employmentType: normalized.employmentType,
        seniority: normalized.seniority,
        visaSponsorship: normalized.visaSponsorship,
        postedAt: normalized.postedAt,
        contentHash: normalized.contentHash,
        relevanceScore: normalized.relevanceScore,
        relevanceTier: normalized.relevanceTier,
        analysis: normalized.analysis,
        matchReasons: normalized.matchReasons,
        concerns: reviewDecision.review
          ? [...normalized.concerns, reviewDecision.reason ?? "Review location"]
          : normalized.concerns,
        rawPayload: normalized.rawPayload,
        status: jobStatus,
        ...immigrationFields,
      });

      await db.insert(jobEvents).values({
        id: randomId(),
        jobId: normalized.id,
        eventType: reviewDecision.review ? "validated" : "discovered",
      });

      result.newJobs++;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}

export async function seedCompanies(db: Db): Promise<void> {
  const universe = (await import("@/data/market-universe.json")).default as {
    confirmed: Array<{
      id: string;
      name: string;
      atsType: string;
      atsSlug: string;
    }>;
  };

  for (const seed of universe.confirmed) {
    await db
      .insert(companies)
      .values({
        id: seed.id,
        name: seed.name,
        atsType: seed.atsType,
        atsSlug: seed.atsSlug,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: companies.id,
        set: {
          name: seed.name,
          atsType: seed.atsType,
          atsSlug: seed.atsSlug,
          updatedAt: new Date(),
        },
      });
  }
}
