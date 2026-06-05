import {
  isImportedDeck,
  isPublishedSourceDeck,
  listDeckFeedback,
  type DeckItem,
  type ListDeckFeedbackRes,
} from "@/lib/api";

export function parseFeedbackMetaTotal(meta: ListDeckFeedbackRes["meta"]): number {
  const v = meta.total;
  if (typeof v === "number" && v >= 0) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  }
  return 0;
}

function publishedSourceDecks(decks: DeckItem[]): DeckItem[] {
  return decks.filter((d) => !isImportedDeck(d) && isPublishedSourceDeck(d));
}

/** Open feedback counts per published source deck (deck id → count). */
export async function fetchOpenFeedbackCounts(
  decks: DeckItem[],
  token: string
): Promise<Record<string, number>> {
  const sources = publishedSourceDecks(decks);
  if (sources.length === 0) return {};

  const pairs = await Promise.all(
    sources.map(async (d) => {
      try {
        const res = await listDeckFeedback(d.id, { status: "open", limit: 1 }, token);
        const total = parseFeedbackMetaTotal(res.meta);
        return [d.id, total] as const;
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn(`[deck feedback] check failed for ${d.id}:`, e);
        }
        return [d.id, 0] as const;
      }
    })
  );

  const counts: Record<string, number> = {};
  for (const [id, n] of pairs) {
    if (n > 0) counts[id] = n;
  }
  return counts;
}

export function totalOpenFeedback(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

export function decksWithOpenFeedback(counts: Record<string, number>): number {
  return Object.keys(counts).length;
}

export function anyOpenFeedback(counts: Record<string, number>): boolean {
  return totalOpenFeedback(counts) > 0;
}

/** Deck id with the most open feedback (for banner link). */
export function firstDeckIdWithMostFeedback(counts: Record<string, number>): string | undefined {
  let bestId: string | undefined;
  let bestCount = 0;
  for (const [id, n] of Object.entries(counts)) {
    if (n > bestCount) {
      bestCount = n;
      bestId = id;
    }
  }
  return bestId;
}
