import { describe, it, expect } from "vitest";
import {
  isLikelyInfraJobTitle,
  passesAggregatorPrefilter,
  tagsSuggestInfra,
} from "@/lib/discovery/title-prefilter";
import { countJobs } from "@/lib/discovery/ats-probe";

describe("title prefilter", () => {
  it("accepts infra titles", () => {
    expect(isLikelyInfraJobTitle("Staff Site Reliability Engineer")).toBe(true);
    expect(isLikelyInfraJobTitle("Senior Platform Engineer")).toBe(true);
  });

  it("rejects non-infra titles", () => {
    expect(isLikelyInfraJobTitle("Senior Sales Analyst")).toBe(false);
    expect(isLikelyInfraJobTitle("Principal Product Manager")).toBe(false);
  });

  it("uses tags as secondary signal", () => {
    expect(tagsSuggestInfra(["devops", "remote"])).toBe(true);
    expect(passesAggregatorPrefilter("Engineering Manager", ["sre"])).toBe(true);
  });
});

describe("ats probe job counting", () => {
  it("counts greenhouse and ashby payloads", () => {
    expect(countJobs("greenhouse", { jobs: [{ id: 1 }, { id: 2 }] })).toBe(2);
    expect(countJobs("lever", [{ id: "a" }])).toBe(1);
  });
});
