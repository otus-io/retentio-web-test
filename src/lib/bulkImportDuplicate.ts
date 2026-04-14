import type { FactItem } from "@/lib/api";

/** Same normalization as duplicate detection within the preview table. */
export function importRowTextSignature(values: string[]): string {
  return values.map((c) => c.trim()).join("\u001e");
}

/** Text-only signature for a fact, aligned to `columnCount` fields (missing entries = ""). */
export function factTextSignature(fact: FactItem, columnCount: number): string {
  return Array.from({ length: columnCount }, (_, i) =>
    (fact.entries[i]?.text ?? "").trim()
  ).join("\u001e");
}

function existingFactTextSignatureSet(facts: FactItem[], columnCount: number): Set<string> {
  const s = new Set<string>();
  for (const f of facts) {
    s.add(factTextSignature(f, columnCount));
  }
  return s;
}

export type FilterDuplicateImportRowsResult<T> = {
  kept: T[];
  skippedAlreadyInDeck: number;
  skippedDuplicateInCsv: number;
};

/**
 * Drops rows whose text matches a fact already in the deck, then keeps only the first
 * occurrence of each remaining text row (CSV self-duplicates).
 */
export function filterDuplicateImportRows<T extends { values: string[] }>(
  rows: T[],
  existingFacts: FactItem[],
  columnCount: number
): FilterDuplicateImportRowsResult<T> {
  const existingSet = existingFactTextSignatureSet(existingFacts, columnCount);
  const seen = new Set<string>();
  const kept: T[] = [];
  let skippedAlreadyInDeck = 0;
  let skippedDuplicateInCsv = 0;
  for (const r of rows) {
    const sig = importRowTextSignature(r.values);
    if (existingSet.has(sig)) {
      skippedAlreadyInDeck++;
      continue;
    }
    if (seen.has(sig)) {
      skippedDuplicateInCsv++;
      continue;
    }
    seen.add(sig);
    kept.push(r);
  }
  return { kept, skippedAlreadyInDeck, skippedDuplicateInCsv };
}
