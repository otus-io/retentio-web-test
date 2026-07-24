import { describe, it, expect } from "vitest";
import { formatReviewIntervalLabel } from "./reviewIntervalLabel";

describe("formatReviewIntervalLabel", () => {
  it("formats seconds with ceil under 60s", () => {
    expect(formatReviewIntervalLabel(0)).toBe("0s");
    expect(formatReviewIntervalLabel(59)).toBe("59s");
    expect(formatReviewIntervalLabel(59.1)).toBe("60s");
  });

  it("formats minutes with ceil under 1h", () => {
    expect(formatReviewIntervalLabel(60)).toBe("1m");
    expect(formatReviewIntervalLabel(61)).toBe("2m");
    expect(formatReviewIntervalLabel(3599)).toBe("60m");
  });

  it("formats hours with one decimal under 1d", () => {
    expect(formatReviewIntervalLabel(3600)).toBe("1.0h");
    expect(formatReviewIntervalLabel(86399)).toBe("24.0h");
  });

  it("formats days with one decimal under 30d", () => {
    expect(formatReviewIntervalLabel(86400)).toBe("1.0d");
    expect(formatReviewIntervalLabel(2591999)).toBe("30.0d");
  });

  it("formats months and years", () => {
    expect(formatReviewIntervalLabel(2592000)).toBe("1.0mo");
    expect(formatReviewIntervalLabel(31103999)).toBe("12.0mo");
    expect(formatReviewIntervalLabel(31104000)).toBe("1.0y");
  });
});
