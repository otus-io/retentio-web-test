import { describe, it, expect } from "vitest";
import {
  bucketForScore,
  buildQualityHistogram,
  buildHumanVerifiedEntries,
  entriesInBucket,
  entryMinScore,
  isFactHumanVerified,
  listQualityEntries,
  stripHumanVerifiedAspects,
  withMaxEntryScores,
  withUpdatedEntryScores,
  type FactQuality,
} from "@/lib/quality";

const sampleItems: FactQuality[] = [
  {
    fact_id: "a",
    updated_at: "2026-01-01T00:00:00Z",
    entries: {
      "0": { text: { score: 2, model: "claude" } },
      "1": { text: { score: 6, model: "claude" }, audio: { score: 9, model: "elevenlabs" } },
      "2": { text: { score: 10, model: "human" } },
      "3": { audio: { score: 8, model: "elevenlabs" } },
    },
  },
  {
    fact_id: "b",
    updated_at: "2026-01-01T00:00:00Z",
    entries: {
      "0": { text: { score: 5, model: "claude" } },
    },
  },
];

describe("entryMinScore", () => {
  it("returns the worst aspect score", () => {
    expect(entryMinScore({ text: { score: 8, model: "claude" }, audio: { score: 3, model: "elevenlabs" } })).toBe(3);
  });

  it("returns null when no aspects", () => {
    expect(entryMinScore({})).toBeNull();
  });
});

describe("bucketForScore", () => {
  it("maps scores into the four buckets", () => {
    expect(bucketForScore(1)).toBe("1-5");
    expect(bucketForScore(5)).toBe("1-5");
    expect(bucketForScore(6)).toBe("6-7");
    expect(bucketForScore(7)).toBe("6-7");
    expect(bucketForScore(8)).toBe("8-9");
    expect(bucketForScore(9)).toBe("8-9");
    expect(bucketForScore(10)).toBe("10");
  });

  it("ignores out-of-range scores", () => {
    expect(bucketForScore(0)).toBeNull();
    expect(bucketForScore(11)).toBeNull();
  });
});

describe("buildQualityHistogram", () => {
  it("counts entries by min aspect score", () => {
    expect(buildQualityHistogram(sampleItems)).toEqual({
      "1-5": 2,
      "6-7": 1,
      "8-9": 1,
      "10": 1,
    });
  });
});

describe("listQualityEntries / entriesInBucket", () => {
  it("lists entries with aspect scores, worst first", () => {
    const rows = listQualityEntries(sampleItems);
    expect(rows.map((r) => ({ factId: r.factId, entryIndex: r.entryIndex, minScore: r.minScore }))).toEqual([
      { factId: "a", entryIndex: "0", minScore: 2 },
      { factId: "b", entryIndex: "0", minScore: 5 },
      { factId: "a", entryIndex: "1", minScore: 6 },
      { factId: "a", entryIndex: "3", minScore: 8 },
      { factId: "a", entryIndex: "2", minScore: 10 },
    ]);
    expect(rows[0]).toMatchObject({ textScore: 2, audioScore: null, textModel: "claude" });
    expect(rows[2]).toMatchObject({ textScore: 6, audioScore: 9, audioModel: "elevenlabs" });
  });

  it("filters rows for a selected bucket", () => {
    const rows = listQualityEntries(sampleItems);
    expect(entriesInBucket(rows, "1-5").map((r) => r.minScore)).toEqual([2, 5]);
    expect(entriesInBucket(rows, "8-9")).toHaveLength(1);
    expect(entriesInBucket(rows, "8-9")[0].entryIndex).toBe("3");
  });
});

describe("withUpdatedEntryScores / withMaxEntryScores", () => {
  const entries = sampleItems[0].entries;

  it("updates only the requested present aspects", () => {
    const next = withUpdatedEntryScores(entries, "1", { text: 10 });
    expect(next["1"]).toEqual({
      text: { score: 10, model: "claude" },
      audio: { score: 9, model: "elevenlabs" },
    });
    expect(next["0"]).toEqual(entries["0"]);
  });

  it("sets every present aspect to max", () => {
    expect(withMaxEntryScores(entries, "1")).toEqual({
      ...entries,
      "1": {
        text: { score: 10, model: "claude" },
        audio: { score: 10, model: "elevenlabs" },
      },
    });
  });
});

describe("human verification helpers", () => {
  const fact = {
    entries: [
      { text: "こんにちは", audio: "aud1" },
      { text: "hello" },
      { text: "", audio: "" },
    ],
  };

  it("isFactHumanVerified requires human/10 on every content aspect", () => {
    expect(isFactHumanVerified(fact, null)).toBe(false);
    expect(
      isFactHumanVerified(fact, {
        fact_id: "f",
        updated_at: "",
        entries: {
          "0": {
            text: { score: 10, model: "human" },
            audio: { score: 10, model: "human" },
          },
          "1": { text: { score: 10, model: "human" } },
        },
      })
    ).toBe(true);
    expect(
      isFactHumanVerified(fact, {
        fact_id: "f",
        updated_at: "",
        entries: {
          "0": {
            text: { score: 10, model: "human" },
            audio: { score: 9, model: "human" },
          },
          "1": { text: { score: 10, model: "human" } },
        },
      })
    ).toBe(false);
  });

  it("buildHumanVerifiedEntries sets human/10 and keeps other indexes", () => {
    const built = buildHumanVerifiedEntries(fact, {
      "0": { text: { score: 3, model: "claude" } },
      "9": { audio: { score: 4, model: "elevenlabs" } },
    });
    expect(built["0"]).toEqual({
      text: { score: 10, model: "human" },
      audio: { score: 10, model: "human" },
    });
    expect(built["1"]).toEqual({ text: { score: 10, model: "human" } });
    expect(built["9"]).toEqual({ audio: { score: 4, model: "elevenlabs" } });
    expect(built["2"]).toBeUndefined();
  });

  it("stripHumanVerifiedAspects drops human/10 aspects", () => {
    expect(
      stripHumanVerifiedAspects({
        "0": {
          text: { score: 10, model: "human" },
          audio: { score: 8, model: "elevenlabs" },
        },
        "1": { text: { score: 10, model: "human" } },
      })
    ).toEqual({
      "0": { audio: { score: 8, model: "elevenlabs" } },
    });
  });
});
