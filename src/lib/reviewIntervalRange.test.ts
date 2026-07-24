import { describe, it, expect } from "vitest";
import { reviewIntervalRangeFromTimestamps } from "./reviewIntervalRange";

describe("reviewIntervalRangeFromTimestamps", () => {
  it("urgency >= 1 uses 0.5x and 4x current interval (overdue)", () => {
    const r = reviewIntervalRangeFromTimestamps({
      nowSec: 2500,
      lastReview: 1000,
      dueDate: 2000,
    });
    expect(r.currentIntervalSec).toBe(1000);
    expect(r.urgency).toBe(1.5);
    expect(r.minInterval).toBe(500);
    expect(r.maxInterval).toBe(4000);
    expect(r.midInterval).toBe(2000);
  });

  it("urgency == 1 uses overdue branch", () => {
    const r = reviewIntervalRangeFromTimestamps({
      nowSec: 2000,
      lastReview: 1000,
      dueDate: 2000,
    });
    expect(r.urgency).toBe(1);
    expect(r.minInterval).toBe(500);
    expect(r.maxInterval).toBe(4000);
  });

  it("urgency < 1 interpolates min/max toward current interval", () => {
    const r = reviewIntervalRangeFromTimestamps({
      nowSec: 1500,
      lastReview: 1000,
      dueDate: 2000,
    });
    expect(r.urgency).toBe(0.5);
    expect(r.minInterval).toBe(750);
    expect(r.maxInterval).toBe(2500);
    expect(r.midInterval).toBe(1500);
  });

  it("dueDate == lastReview returns zeros (invalid window)", () => {
    const r = reviewIntervalRangeFromTimestamps({
      nowSec: 5000,
      lastReview: 1000,
      dueDate: 1000,
    });
    expect(r.currentIntervalSec).toBe(0);
    expect(r.minInterval).toBe(0);
    expect(r.maxInterval).toBe(0);
    expect(r.midInterval).toBe(0);
    expect(r.urgency).toBe(0);
  });

  it("dueDate < lastReview returns zeros", () => {
    const r = reviewIntervalRangeFromTimestamps({
      nowSec: 5000,
      lastReview: 2000,
      dueDate: 1000,
    });
    expect(r.currentIntervalSec).toBe(0);
    expect(r.minInterval).toBe(0);
    expect(r.maxInterval).toBe(0);
  });

  it("raw interval under 300s floors basis interval; keeps true currentInterval", () => {
    const r = reviewIntervalRangeFromTimestamps({
      nowSec: 1010,
      lastReview: 1000,
      dueDate: 1005,
    });
    expect(r.currentIntervalSec).toBe(5);
    expect(r.urgency).toBeCloseTo(10 / 300, 9);
    expect(r.minInterval).toBe(295);
    expect(r.maxInterval).toBe(330);
    expect(r.midInterval).toBe(310);
  });

  it("urgency 0 widens max when rounded bounds collapse", () => {
    const r = reviewIntervalRangeFromTimestamps({
      nowSec: 1000,
      lastReview: 1000,
      dueDate: 1050,
    });
    expect(r.currentIntervalSec).toBe(50);
    expect(r.urgency).toBe(0);
    expect(r.minInterval).toBe(300);
    expect(r.maxInterval).toBe(1200);
    expect(r.midInterval).toBe(300);
  });
});
