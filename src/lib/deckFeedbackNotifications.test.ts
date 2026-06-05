import { describe, it, expect } from "vitest";
import {
  anyOpenFeedback,
  firstDeckIdWithMostFeedback,
  parseFeedbackMetaTotal,
  totalOpenFeedback,
} from "./deckFeedbackNotifications";

describe("parseFeedbackMetaTotal", () => {
  it("parses numeric and string total", () => {
    expect(parseFeedbackMetaTotal({ msg: "ok", total: 3 })).toBe(3);
    expect(parseFeedbackMetaTotal({ msg: "ok", total: "2" })).toBe(2);
    expect(parseFeedbackMetaTotal({ msg: "ok" })).toBe(0);
  });
});

describe("feedback count helpers", () => {
  it("aggregates open feedback counts", () => {
    const counts = { a: 2, b: 1 };
    expect(totalOpenFeedback(counts)).toBe(3);
    expect(anyOpenFeedback(counts)).toBe(true);
    expect(firstDeckIdWithMostFeedback(counts)).toBe("a");
  });
});
