import { describe, it, expect } from "vitest";
import {
  createEmptyFunnel,
  mergeFunnel,
  recordFunnelReject,
  funnelSummary,
} from "@/lib/pipeline/funnel";
import { shouldReviewIngestJob } from "@/lib/visa/lanes";

describe("Funnel metrics", () => {
  it("merges counts and caps samples", () => {
    const a = createEmptyFunnel();
    a.discovered = 10;
    recordFunnelReject(a, "Location", "Job A");

    const b = createEmptyFunnel();
    b.discovered = 5;
    recordFunnelReject(b, "Location", "Job B");
    recordFunnelReject(b, "Title filter", "Job C");

    const merged = mergeFunnel(a, b);
    expect(merged.discovered).toBe(15);
    expect(merged.rejectReasons.Location).toBe(2);
    expect(merged.samples.Location?.length).toBeLessThanOrEqual(3);
  });

  it("renders a summary string", () => {
    const funnel = createEmptyFunnel();
    funnel.discovered = 100;
    funnel.ingested = 8;
    funnel.locationRejected = 40;
    recordFunnelReject(funnel, "Location", "Staff SRE @ Acme");

    const summary = funnelSummary(funnel);
    expect(summary).toContain("discovered=100");
    expect(summary).toContain("ingested=8");
    expect(summary).toContain("location=40");
  });
});

describe("Review bucket", () => {
  it("accepts borderline location with score >= 0.5", () => {
    const result = shouldReviewIngestJob({
      rejected: false,
      passesTitleFilter: true,
      relevanceScore: 0.55,
      relevanceTier: "potential",
      locationAcceptable: false,
    });
    expect(result.review).toBe(true);
  });

  it("rejects low score borderline location", () => {
    const result = shouldReviewIngestJob({
      rejected: false,
      passesTitleFilter: true,
      relevanceScore: 0.4,
      relevanceTier: "potential",
      locationAcceptable: false,
    });
    expect(result.review).toBe(false);
  });
});
