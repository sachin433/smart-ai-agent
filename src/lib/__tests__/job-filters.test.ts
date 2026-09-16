import { describe, it, expect } from "vitest";
import {
  VISA_SPONSORED_STATUSES,
  VISA_VERIFY_STATUSES,
  matchesVisaFilter,
  parseVisaFilter,
} from "@/lib/db/job-filters";

describe("visa filter allowlists", () => {
  it("uses disjoint positive allowlists for sponsored vs verify", () => {
    for (const status of VISA_SPONSORED_STATUSES) {
      expect(matchesVisaFilter(status, "sponsored")).toBe(true);
      expect(matchesVisaFilter(status, "verify")).toBe(false);
    }
    for (const status of VISA_VERIFY_STATUSES) {
      expect(matchesVisaFilter(status, "verify")).toBe(true);
      expect(matchesVisaFilter(status, "sponsored")).toBe(false);
    }
  });

  it("excludes unknown future statuses from both filters", () => {
    expect(matchesVisaFilter("pending_verification", "sponsored")).toBe(false);
    expect(matchesVisaFilter("pending_verification", "verify")).toBe(false);
    expect(matchesVisaFilter("negative_work_authorization", "sponsored")).toBe(false);
    expect(matchesVisaFilter("negative_work_authorization", "verify")).toBe(false);
  });

  it("returns all jobs when visa filter is unset", () => {
    expect(matchesVisaFilter("unknown")).toBe(true);
    expect(matchesVisaFilter("explicit_sponsorship")).toBe(true);
  });
});

describe("parseVisaFilter", () => {
  it("accepts only known filter values", () => {
    expect(parseVisaFilter("sponsored")).toBe("sponsored");
    expect(parseVisaFilter("verify")).toBe("verify");
    expect(parseVisaFilter("invalid")).toBeUndefined();
    expect(parseVisaFilter(null)).toBeUndefined();
  });
});
