import {
  deckHasUpdatesAvailable,
  getDeckUpdates,
  importedDeckUpdateAvailable,
  isImportedDeck,
  type DeckItem,
} from "@/lib/api";

/** For each imported deck, whether the source has a newer published version. */
export async function fetchImportedDeckUpdateFlags(
  decks: DeckItem[],
  token: string
): Promise<Record<string, boolean>> {
  const imported = decks.filter(isImportedDeck);
  if (imported.length === 0) return {};

  const flags: Record<string, boolean> = {};
  const needsApi: DeckItem[] = [];

  for (const d of imported) {
    if (typeof d.latest_source_version === "number" || typeof d.source_update_available === "boolean") {
      flags[d.id] = importedDeckUpdateAvailable(d);
    } else {
      needsApi.push(d);
    }
  }

  if (needsApi.length === 0) return flags;

  const pairs = await Promise.all(
    needsApi.map(async (d) => {
      try {
        const res = await getDeckUpdates(d.id, token);
        return [d.id, deckHasUpdatesAvailable(res.data)] as const;
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn(`[deck updates] check failed for ${d.id}:`, e);
        }
        return [d.id, importedDeckUpdateAvailable(d)] as const;
      }
    })
  );
  for (const [id, available] of pairs) {
    flags[id] = available;
  }
  return flags;
}

export function countDeckUpdates(flags: Record<string, boolean>): number {
  return Object.values(flags).filter(Boolean).length;
}

export function anyDeckUpdates(flags: Record<string, boolean>): boolean {
  return countDeckUpdates(flags) > 0;
}

/** Merge update flags from freshly loaded deck rows (immediate notification after GET /decks). */
export function flagsFromDeckList(decks: DeckItem[]): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const d of decks) {
    if (!isImportedDeck(d)) continue;
    if (typeof d.latest_source_version !== "number" && typeof d.source_update_available !== "boolean") {
      continue;
    }
    flags[d.id] = importedDeckUpdateAvailable(d);
  }
  return flags;
}
