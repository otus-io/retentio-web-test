import { describe, expect, it } from "vitest";
import {
  appendEmptyEntryColumnToAllFacts,
  cloneFactsList,
  existingFactsHeaderLabels,
  mergeFactListsPreservingPriorOrder,
  mergeParentFirstPagePreservingTail,
  mergeServerFactsPreservingDirty,
  insertEmptyEntryAfter,
  removeFactEntryAt,
  trimAllFactsToEntryCount,
} from "./existingFactsSpreadsheet";

describe("mergeServerFactsPreservingDirty", () => {
  it("replaces non-dirty facts from server", () => {
    const server = [{ id: "a", entries: [{ text: "new" }] }];
    const prev = [{ id: "a", entries: [{ text: "old" }] }];
    expect(mergeServerFactsPreservingDirty(prev, server, new Set())).toEqual(cloneFactsList(server));
  });

  it("keeps local row when dirty", () => {
    const server = [{ id: "a", entries: [{ text: "server" }] }];
    const prev = [{ id: "a", entries: [{ text: "local" }] }];
    const merged = mergeServerFactsPreservingDirty(prev, server, new Set(["a"]));
    expect(merged[0]?.entries[0]?.text).toBe("local");
  });
});

describe("appendEmptyEntryColumnToAllFacts / trimAllFactsToEntryCount", () => {
  it("appends one empty entry per fact", () => {
    const facts = [
      { id: "a", entries: [{ text: "x" }] },
      { id: "b", entries: [{}, { text: "y" }] },
    ];
    const out = appendEmptyEntryColumnToAllFacts(facts);
    expect(out[0]?.entries).toHaveLength(2);
    expect(out[0]?.entries[1]).toEqual({});
    expect(out[1]?.entries).toHaveLength(3);
  });

  it("trims longer rows to new length", () => {
    const facts = [{ id: "a", entries: [{ text: "1" }, { text: "2" }, { text: "3" }] }];
    const out = trimAllFactsToEntryCount(facts, 2);
    expect(out[0]?.entries.map((e) => e.text)).toEqual(["1", "2"]);
  });
});

describe("insertEmptyEntryAfter", () => {
  it("inserts after the given index", () => {
    const f = { id: "x", entries: [{ text: "a" }, { text: "b" }] };
    const out = insertEmptyEntryAfter(f, 0);
    expect(out.entries.length).toBe(3);
    expect(out.entries[0]?.text).toBe("a");
    expect(out.entries[1]).toEqual({});
    expect(out.entries[2]?.text).toBe("b");
  });

  it("appends when index is past the last entry", () => {
    const f = { id: "x", entries: [{ text: "a" }] };
    const out = insertEmptyEntryAfter(f, 5);
    expect(out.entries).toEqual([{ text: "a" }, {}]);
  });
});

describe("removeFactEntryAt", () => {
  it("removes the entry at the given index", () => {
    const f = { id: "x", entries: [{ text: "a" }, { text: "b" }, { text: "c" }] };
    const out = removeFactEntryAt(f, 1);
    expect(out.entries.map((e) => e.text)).toEqual(["a", "c"]);
  });

  it("does not remove when only one entry", () => {
    const f = { id: "x", entries: [{ text: "only" }] };
    expect(removeFactEntryAt(f, 0)).toEqual(f);
  });
});

describe("existingFactsHeaderLabels", () => {
  it("uses deck names as-is including empty strings", () => {
    expect(existingFactsHeaderLabels(3, ["Front", "", "Back"])).toEqual(["Front", "", "Back"]);
  });

  it("pads with empty strings past deck length", () => {
    expect(existingFactsHeaderLabels(3, ["A"])).toEqual(["A", "", ""]);
  });
});

describe("mergeParentFirstPagePreservingTail", () => {
  it("updates first page from server and keeps tail rows", () => {
    const prev = [
      { id: "a", entries: [{ text: "dirty-a" }] },
      { id: "b", entries: [{ text: "b" }] },
      { id: "c", entries: [{ text: "tail" }] },
    ];
    const serverFirst = [
      { id: "a", entries: [{ text: "server-a" }] },
      { id: "b", entries: [{ text: "server-b" }] },
    ];
    const dirty = new Set<string>(["a"]);
    const out = mergeParentFirstPagePreservingTail(prev, serverFirst, dirty);
    expect(out.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(out[0]?.entries[0]?.text).toBe("dirty-a");
    expect(out[1]?.entries[0]?.text).toBe("server-b");
    expect(out[2]?.entries[0]?.text).toBe("tail");
  });
});

describe("mergeFactListsPreservingPriorOrder", () => {
  it("keeps prior order then appends new ids", () => {
    const prior = [
      { id: "a", entries: [{ text: "1" }] },
      { id: "b", entries: [{ text: "2" }] },
    ];
    const incoming = [
      { id: "n", entries: [{ text: "new" }] },
      { id: "b", entries: [{ text: "2b" }] },
      { id: "a", entries: [{ text: "1a" }] },
    ];
    const out = mergeFactListsPreservingPriorOrder(prior, incoming);
    expect(out.map((f) => f.id)).toEqual(["a", "b", "n"]);
    expect(out[0]?.entries[0]?.text).toBe("1a");
    expect(out[1]?.entries[0]?.text).toBe("2b");
  });
});
