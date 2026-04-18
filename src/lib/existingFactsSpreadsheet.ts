import type { Entry, FactItem } from "@/lib/api";
import { fileLooksLikeJson } from "@/lib/api";

export function existingFactsColumnCount(deckFields: string[], facts: FactItem[]): number {
  const fromFacts = facts.reduce((m, f) => Math.max(m, f.entries?.length ?? 0), 0);
  return Math.max(deckFields.length, fromFacts, 1);
}

/** Labels for the sheet header row; empty strings are allowed (no placeholder names). */
export function existingFactsHeaderLabels(colCount: number, deckFields: string[]): string[] {
  return Array.from({ length: colCount }, (_, i) => (i < deckFields.length ? deckFields[i] ?? "" : ""));
}

export function factEntryAt(fact: FactItem, idx: number): Entry {
  return fact.entries[idx] ? { ...fact.entries[idx] } : {};
}

export function factHasSomeContent(entries: Entry[]): boolean {
  return entries.some(
    (e) =>
      (e.text?.trim() ?? "") !== "" ||
      Boolean(e.audio) ||
      Boolean(e.image) ||
      Boolean(e.video) ||
      Boolean(e.json)
  );
}

export function updateFactEntryText(fact: FactItem, entryIndex: number, text: string): FactItem {
  const len = Math.max(fact.entries.length, entryIndex + 1);
  const entries: Entry[] = Array.from({ length: len }, (_, j) => {
    const base = fact.entries[j] ? { ...fact.entries[j] } : {};
    if (j === entryIndex) return { ...base, text };
    return base;
  });
  return { ...fact, entries };
}

export function mergeEntryMediaPatch(
  fact: FactItem,
  entryIndex: number,
  patch: Partial<Pick<Entry, "audio" | "image" | "video" | "json">>
): FactItem {
  const len = Math.max(fact.entries.length, entryIndex + 1);
  const entries: Entry[] = Array.from({ length: len }, (_, j) => {
    const base = fact.entries[j] ? { ...fact.entries[j] } : {};
    if (j !== entryIndex) return base;
    return { ...base, ...patch };
  });
  return { ...fact, entries };
}

export function clearEntryMediaSlot(
  fact: FactItem,
  entryIndex: number,
  slot: "audio" | "image" | "video" | "json"
): FactItem {
  const len = Math.max(fact.entries.length, entryIndex + 1);
  const entries: Entry[] = Array.from({ length: len }, (_, j) => {
    const base = fact.entries[j] ? { ...fact.entries[j] } : {};
    if (j !== entryIndex) return base;
    const next = { ...base };
    delete next[slot];
    return next;
  });
  return { ...fact, entries };
}

export function mediaSlotForFile(file: File): "audio" | "image" | "video" | "json" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/") || file.type === "application/ogg") return "audio";
  if (fileLooksLikeJson(file)) return "json";
  return null;
}

export function cloneFactsList(list: FactItem[]): FactItem[] {
  return list.map((f) => ({
    ...f,
    entries: f.entries.map((e) => ({ ...e })),
  }));
}

/** Minimum grid width: deck schema columns, or one empty column when the deck has no fields yet. */
export function minSpreadsheetColumnCount(deckFields: string[]): number {
  return Math.max(deckFields.length, 1);
}

/** Append one empty entry to every fact (same as adding a column for all rows). */
export function appendEmptyEntryColumnToAllFacts(facts: FactItem[]): FactItem[] {
  return facts.map((f) => ({ ...f, entries: [...f.entries, {}] }));
}

/** Drop entries past the last index after shrinking the grid (removes the rightmost column). */
export function trimAllFactsToEntryCount(facts: FactItem[], newLength: number): FactItem[] {
  return facts.map((f) =>
    f.entries.length > newLength ? { ...f, entries: f.entries.slice(0, newLength) } : f
  );
}

/** Remove one entry by index so this fact can be shorter than others (at least one entry remains). */
export function removeFactEntryAt(fact: FactItem, entryIndex: number): FactItem {
  if (entryIndex < 0 || entryIndex >= fact.entries.length || fact.entries.length <= 1) {
    return fact;
  }
  const entries = fact.entries.filter((_, j) => j !== entryIndex);
  return { ...fact, entries };
}

/** Insert an empty entry immediately after `entryIndex` (append when index is past the last cell). */
export function insertEmptyEntryAfter(fact: FactItem, entryIndex: number): FactItem {
  const insertAt = Math.min(Math.max(0, entryIndex + 1), fact.entries.length);
  const entries = [...fact.entries.slice(0, insertAt), {}, ...fact.entries.slice(insertAt)];
  return { ...fact, entries };
}

/**
 * GET /facts order is undefined (Redis set). Keep prior list order for ids that still exist, then append
 * any new ids in `incoming` order so "add row" / append results show up at the bottom.
 */
export function mergeFactListsPreservingPriorOrder(prior: FactItem[], incoming: FactItem[]): FactItem[] {
  const incomingById = new Map(incoming.map((f) => [f.id, f]));
  const out: FactItem[] = [];
  const used = new Set<string>();
  for (const id of prior.map((f) => f.id)) {
    const f = incomingById.get(id);
    if (f) {
      out.push(f);
      used.add(id);
    }
  }
  for (const f of incoming) {
    if (!used.has(f.id)) {
      out.push(f);
      used.add(f.id);
    }
  }
  return out;
}

/** When server list updates, keep local edits for rows still marked dirty. */
export function mergeServerFactsPreservingDirty(
  prev: FactItem[],
  server: FactItem[],
  dirty: Set<string>
): FactItem[] {
  const prevById = new Map(prev.map((f) => [f.id, f]));
  return server.map((sf) => {
    if (dirty.has(sf.id)) {
      return prevById.get(sf.id) ?? { ...sf, entries: sf.entries.map((e) => ({ ...e })) };
    }
    return { ...sf, entries: sf.entries.map((e) => ({ ...e })) };
  });
}
