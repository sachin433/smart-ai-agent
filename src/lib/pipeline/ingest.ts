import { eq, and } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { jobs, jobEvents, companies } from "@/lib/db/schema";
import type { CandidateProfile } from "@/lib/types";
import type { RawJob } from "@/lib/types";
import { normalizeJob } from "./normalize";
import { randomId } from "@/lib/utils/hash";
import { shouldIngestJob } from "@/lib/visa/lanes";
import type { VisaImmigrationStatus } from "@/lib/visa/types";

export interface IngestResult {
  discovered: number;
  newJobs: number;
  updated: number;
  duplicates: number;
  relevant: number;
  errors: string[];
}

export async function ingestRawJobs(
  db: Db,
  rawJobs: RawJob[],
  profile: CandidateProfile,
  companyId?: string,
): Promise<IngestResult> {
  const result: IngestResult = {
    discovered: rawJobs.length,
    newJobs: 0,
    updated: 0,
    duplicates: 0,
    relevant: 0,
    errors: [],
  };

  for (const raw of rawJobs) {
    try {
      const normalized = await normalizeJob({ raw, companyId, profile });

      const ingestDecision = shouldIngestJob({
        rejected: normalized.rejected,
        passesTitleFilter: normalized.passesTitleFilter,
        relevanceScore: normalized.relevanceScore,
        relevanceTier: normalized.relevanceTier,
        lane: normalized.priorityLane,
        visaStatus: normalized.visaImmigrationStatus as VisaImmigrationStatus,
        locationAcceptable: normalized.locationAcceptable,
      });

      if (!ingestDecision.ingest) continue;

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

      const existing =
        existingBySource[0] ?? existingByUrl[0] ?? existingByHash[0];

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
            ...(contentChanged
              ? { status: "discovered" as const }
              : {}),
          })
          .where(eq(jobs.id, existing.id));

        if (contentChanged) {
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
        (normalized.relevanceTier === "exceptional" ||
          normalized.relevanceTier === "strong" ||
          normalized.relevanceTier === "potential");

      if (!isRelevant) continue;

      result.relevant++;

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
        concerns: normalized.concerns,
        rawPayload: normalized.rawPayload,
        status: "matched",
        ...immigrationFields,
      });

      await db.insert(jobEvents).values({
        id: randomId(),
        jobId: normalized.id,
        eventType: "discovered",
      });

      result.newJobs++;
    } catch (err) {
      result.errors.push(
        err instanceof Error ? err.message : String(err),
      );
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
          enabled: true,
          updatedAt: new Date(),
        },
      });
  }
}
