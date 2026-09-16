import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "@/lib/utils/url";
import { normalizeTitle, jaccardSimilarity, tokenize } from "@/lib/utils/text";
import { classifyLocations, extractVisaSignals } from "@/lib/location/classifier";
import { scoreJob, titleMatchesSearchRings } from "@/lib/scoring/relevance";
import { DEFAULT_PROFILE } from "@/lib/defaults/profile";
import { classifyVisaEligibility } from "@/lib/visa/classifier";
import { assignPriorityLane, getMinIngestScore } from "@/lib/visa/lanes";
import { isSecurityRole } from "@/lib/scoring/security-filter";
import { getTitleRejectReason } from "@/lib/scoring/role-filter";

describe("URL canonicalization", () => {
  it("strips utm parameters", () => {
    const url = canonicalizeUrl(
      "https://example.com/jobs/123?utm_source=foo&ref=bar&keep=yes",
    );
    expect(url).not.toContain("utm_source");
    expect(url).not.toContain("ref=");
    expect(url).toContain("keep=yes");
  });
});

describe("Title normalization", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeTitle("  Staff   SRE  ")).toBe("staff sre");
  });
});

describe("Location classifier", () => {
  it("accepts EU locations", () => {
    const result = classifyLocations(["Amsterdam, Netherlands"]);
    expect(result.acceptable).toBe(true);
  });

  it("rejects US-only remote", () => {
    const result = classifyLocations(["Remote - US only"]);
    expect(result.usOnly).toBe(true);
    expect(result.acceptable).toBe(false);
  });

  it("flags unknown remote scope as not acceptable", () => {
    const result = classifyLocations(["Remote"]);
    expect(result.remoteScope).toBe("unknown");
    expect(result.acceptable).toBe(false);
  });

  it("rejects US-primary remote without EU option", () => {
    const result = classifyLocations(["United States (Remote)", "Canada (Remote)"]);
    expect(result.acceptable).toBe(false);
  });

  it("accepts EU remote roles", () => {
    const result = classifyLocations(["Germany (Remote)", "Ireland (Remote)"]);
    expect(result.acceptable).toBe(true);
  });

  it("accepts Pune and India locations", () => {
    expect(classifyLocations(["Pune, India"]).acceptable).toBe(true);
    expect(classifyLocations(["Remote - India"]).acceptable).toBe(true);
    expect(classifyLocations(["Pune, India"]).remoteScope).toBe("Pune");
    expect(classifyLocations(["Hyderabad, India"]).inIndia).toBe(true);
    expect(classifyLocations(["Bengaluru, India"]).inIndia).toBe(true);
  });

  it("classifies UK separately from EU", () => {
    const uk = classifyLocations(["London, UK"]);
    expect(uk.inUk).toBe(true);
    expect(uk.inEu).toBe(false);
    expect(uk.locationCategory).toBe("UK");
  });

  it("classifies Germany as EU high priority", () => {
    const de = classifyLocations(["Berlin, Germany"]);
    expect(de.locationCategory).toBe("EU_HIGH_PRIORITY");
    expect(de.countryCode).toBe("DE");
  });
});

describe("Visa classifier", () => {
  it("detects explicit sponsorship", () => {
    const result = classifyVisaEligibility("We offer visa sponsorship and relocation support.");
    expect(result.status).toBe("explicit_sponsorship");
    expect(result.hardReject).toBe(false);
  });

  it("hard rejects no sponsorship", () => {
    const result = classifyVisaEligibility("No visa sponsorship available for this role.");
    expect(result.status).toBe("negative_work_authorization");
    expect(result.hardReject).toBe(true);
  });

  it("hard rejects EU work authorization required", () => {
    const result = classifyVisaEligibility("Valid EU work permit required.");
    expect(result.hardReject).toBe(true);
  });

  it("hard rejects Lemon.io-style marketplace disclaimer even when client role mentions relocation", () => {
    const text = `
      Direct hire for our client. Relocation and visa assistance included.
      We do not provide visa assistance, and our cooperation model does not include
      the benefits typically offered with direct hire.
    `;
    const result = classifyVisaEligibility(text);
    expect(result.status).toBe("negative_work_authorization");
    expect(result.hardReject).toBe(true);
  });

  it("does not infer sponsorship from silence", () => {
    expect(classifyVisaEligibility("Kubernetes platform role in Amsterdam.").status).toBe("unknown");
  });
});

describe("Priority lanes", () => {
  it("assigns P0 for EU role with explicit sponsorship", () => {
    const loc = classifyLocations(["Berlin, Germany"]);
    const visa = classifyVisaEligibility("Visa sponsorship available for international candidates.");
    const lane = assignPriorityLane(loc, visa, "gitlab", "GitLab");
    expect(lane.lane).toBe("P0");
  });

  it("assigns P2 for UK roles", () => {
    const loc = classifyLocations(["London, UK"]);
    const visa = classifyVisaEligibility("Great SRE role.");
    expect(assignPriorityLane(loc, visa).lane).toBe("P2");
  });

  it("assigns P3 for India roles", () => {
    const loc = classifyLocations(["Pune, India"]);
    const visa = classifyVisaEligibility("Platform engineer.");
    expect(assignPriorityLane(loc, visa).lane).toBe("P3");
  });

  it("uses lower P0 threshold when visa is positive", () => {
    expect(getMinIngestScore("P0", "explicit_sponsorship")).toBe(0.55);
    expect(getMinIngestScore("P1", "unknown")).toBe(0.62);
  });
});

describe("Visa extraction", () => {
  it("does not infer sponsorship from silence", () => {
    const result = extractVisaSignals("Great role with Kubernetes.");
    expect(result.visaSponsorship).toBe("unknown");
  });

  it("detects no sponsorship", () => {
    const result = extractVisaSignals("No visa sponsorship available.");
    expect(result.visaSponsorship).toBe("not_available");
  });
});

describe("Security role exclusion", () => {
  it("rejects security-focused titles", () => {
    expect(isSecurityRole("Staff Cloud Security Architect")).toBe(true);
    expect(isSecurityRole("Security Software Engineer, Infrastructure Security")).toBe(true);
    expect(getTitleRejectReason("Senior Security Engineer")).toContain("Security");
    expect(isSecurityRole("Staff Site Reliability Engineer")).toBe(false);
  });
});

describe("Title search rings", () => {
  it("accepts compound infrastructure software engineer titles", () => {
    expect(
      titleMatchesSearchRings(
        "Staff Software Engineer (Infrastructure)",
        DEFAULT_PROFILE,
      ),
    ).toBe(true);
    expect(
      titleMatchesSearchRings(
        "Senior Staff Engineer - Platform & Partner Experience",
        DEFAULT_PROFILE,
      ),
    ).toBe(true);
  });

  it("rejects principal and GPU titles", () => {
    expect(
      titleMatchesSearchRings("Principal SRE", DEFAULT_PROFILE),
    ).toBe(false);
    expect(
      titleMatchesSearchRings("GPU Infrastructure Engineer", DEFAULT_PROFILE),
    ).toBe(false);
  });
});

describe("Relevance scoring — E2E fixtures", () => {
  it("Job A: Staff Infrastructure Engineer Amsterdam — HIGH MATCH", () => {
    const result = scoreJob(
      "Staff Infrastructure Engineer",
      "AWS GCP Kubernetes Terraform platform architecture ownership",
      ["Amsterdam"],
      DEFAULT_PROFILE,
    );
    expect(result.rejected).toBe(false);
    expect(["exceptional", "strong", "potential"]).toContain(result.tier);
    expect(result.score).toBeGreaterThan(0.45);
  });

  it("Job B: Senior Frontend Engineer — REJECT", () => {
    const result = scoreJob(
      "Senior Frontend Engineer",
      "React TypeScript CSS",
      ["Amsterdam"],
      DEFAULT_PROFILE,
    );
    expect(result.rejected).toBe(true);
  });

  it("Job C: Senior with staff signals — STAFF-EQUIVALENT", () => {
    const result = scoreJob(
      "Senior Infrastructure Engineer",
      "Architecture ownership technical leadership Kubernetes AI platform cross-team influence technical roadmap",
      ["Remote Europe"],
      DEFAULT_PROFILE,
    );
    expect(result.analysis.staffEquivalent).toBe(true);
    expect(result.rejected).toBe(false);
    expect(result.score).toBeGreaterThan(0.45);
  });

  it("Job E: US-only remote — REJECT", () => {
    const result = scoreJob(
      "Staff Platform Engineer",
      "Kubernetes AWS",
      ["Remote - US only"],
      DEFAULT_PROFILE,
    );
    expect(result.rejected).toBe(true);
  });

  it("rejects Senior QA Engineer", () => {
    const result = scoreJob(
      "Senior QA Engineer",
      "Testing automation",
      ["Europe", "Remote"],
      DEFAULT_PROFILE,
    );
    expect(result.rejected).toBe(true);
  });

  it("rejects Senior React Full-stack Developer", () => {
    const result = scoreJob(
      "Senior React Full-stack Developer",
      "React Node.js",
      ["Europe", "Remote"],
      DEFAULT_PROFILE,
    );
    expect(result.rejected).toBe(true);
  });

  it("rejects US-primary Grafana US Remote role", () => {
    const result = scoreJob(
      "Staff Backend Engineer - Grafana Enterprise | US | Remote",
      "Go Kubernetes",
      ["United States (Remote)", "Canada (Remote)"],
      DEFAULT_PROFILE,
    );
    expect(result.rejected).toBe(true);
  });
});

describe("Deduplication similarity", () => {
  it("detects near-duplicate descriptions", () => {
    const a = tokenize("Staff Infrastructure Engineer Amsterdam AWS Kubernetes");
    const b = tokenize("Staff Infrastructure Engineer - Amsterdam AWS Kubernetes");
    const sim = jaccardSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.8);
  });
});
