import { describe, it, expect, beforeEach } from "vitest";
import {
  appendSentContribution,
  clearPendingContributions,
  countPendingContributions,
  listPendingContributions,
  listSentContributions,
  markPendingAsSent,
  previewFromEntries,
  removePendingContribution,
  upsertPendingContribution,
} from "@/lib/pendingContributions";

describe("pendingContributions", () => {
  beforeEach(() => {
    clearPendingContributions("deck1");
    clearPendingContributions("deck2");
    localStorage.removeItem("retentio_sent_contribs_v1:deck1");
  });

  it("upserts by id and counts", () => {
    upsertPendingContribution("deck1", { factId: "f1", kind: "edit", preview: "Apple" });
    upsertPendingContribution("deck1", { factId: "f2", kind: "add" });
    expect(countPendingContributions("deck1")).toBe(2);
    upsertPendingContribution("deck1", { factId: "f1", kind: "edit", preview: "Orange" });
    const list = listPendingContributions("deck1");
    expect(list).toHaveLength(2);
    expect(list.find((r) => r.factId === "f1")?.preview).toBe("Orange");
  });

  it("stores deck tag and field rename pending rows", () => {
    upsertPendingContribution("deck1", {
      kind: "deck_tags",
      addTags: ["food"],
      removeTags: ["old"],
    });
    upsertPendingContribution("deck1", {
      kind: "field_rename",
      proposedFields: ["EN", "JP"],
    });
    expect(countPendingContributions("deck1")).toBe(2);
    expect(listPendingContributions("deck1").map((r) => r.kind).sort()).toEqual([
      "deck_tags",
      "field_rename",
    ]);
  });

  it("removes one pending id", () => {
    upsertPendingContribution("deck1", { factId: "f1", kind: "edit" });
    upsertPendingContribution("deck1", { factId: "f2", kind: "edit" });
    const id = listPendingContributions("deck1").find((r) => r.factId === "f1")!.id;
    removePendingContribution("deck1", id);
    expect(listPendingContributions("deck1").map((r) => r.factId)).toEqual(["f2"]);
  });

  it("moves pending to sent history", () => {
    upsertPendingContribution("deck1", { factId: "f1", kind: "edit", preview: "hi" });
    const id = listPendingContributions("deck1")[0].id;
    markPendingAsSent("deck1", id, { contributionId: "c1" });
    expect(countPendingContributions("deck1")).toBe(0);
    expect(listSentContributions("deck1")[0].contributionId).toBe("c1");
  });

  it("appendSentContribution records history", () => {
    appendSentContribution("deck1", { kind: "report", factId: "f9", preview: "typo" });
    expect(listSentContributions("deck1")).toHaveLength(1);
  });

  it("appendSentContribution keeps report message and contribution id", () => {
    appendSentContribution("deck1", {
      kind: "report",
      factId: "f9",
      preview: "Apple",
      message: "wrong reading",
      contributionId: "c-report-1",
    });
    appendSentContribution("deck1", {
      kind: "report",
      factId: "f9",
      preview: "Apple",
      message: "audio is clipped",
      contributionId: "c-report-2",
    });
    const sent = listSentContributions("deck1");
    expect(sent).toHaveLength(2);
    expect(sent.map((r) => r.message)).toEqual(["audio is clipped", "wrong reading"]);
    expect(sent.map((r) => r.contributionId)).toEqual(["c-report-2", "c-report-1"]);
  });

  it("previewFromEntries uses first non-empty text", () => {
    expect(previewFromEntries([{ text: "" }, { text: "  hi  " }])).toBe("hi");
    expect(previewFromEntries([])).toBeUndefined();
  });
});
