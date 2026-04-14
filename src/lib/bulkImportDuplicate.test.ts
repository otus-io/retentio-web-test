import { describe, expect, it } from "vitest";
import {
  factTextSignature,
  filterDuplicateImportRows,
  importRowTextSignature,
} from "./bulkImportDuplicate";
import type { FactItem } from "@/lib/api";

describe("importRowTextSignature", () => {
  it("joins trimmed cells", () => {
    expect(importRowTextSignature([" a ", "b"])).toBe("a\u001eb");
  });
});

describe("filterDuplicateImportRows", () => {
  const col = 2;
  const existing: FactItem[] = [
    { id: "f1", entries: [{ text: "hello" }, { text: "world" }] },
  ];

  it("skips rows matching existing deck fact text", () => {
    const rows = [
      { values: ["hello", "world"] },
      { values: ["new", "row"] },
    ];
    const r = filterDuplicateImportRows(rows, existing, col);
    expect(r.skippedAlreadyInDeck).toBe(1);
    expect(r.kept).toEqual([{ values: ["new", "row"] }]);
  });

  it("keeps first CSV row when duplicates in file", () => {
    const rows = [
      { values: ["a", "b"] },
      { values: ["a", "b"] },
      { values: ["c", "d"] },
    ];
    const r = filterDuplicateImportRows(rows, [], col);
    expect(r.skippedDuplicateInCsv).toBe(1);
    expect(r.kept).toEqual([{ values: ["a", "b"] }, { values: ["c", "d"] }]);
  });

  it("prefers deck match over csv duplicate counting", () => {
    const rows = [
      { values: ["hello", "world"] },
      { values: ["hello", "world"] },
    ];
    const r = filterDuplicateImportRows(rows, existing, col);
    expect(r.skippedAlreadyInDeck).toBe(2);
    expect(r.skippedDuplicateInCsv).toBe(0);
    expect(r.kept).toEqual([]);
  });
});

describe("factTextSignature", () => {
  it("pads missing entries", () => {
    const f: FactItem = { id: "x", entries: [{ text: "only" }] };
    expect(factTextSignature(f, 2)).toBe("only\u001e");
  });
});
