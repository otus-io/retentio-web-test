import {
  LIST_PAGINATION_DEFAULT_LIMIT,
  request,
  type FactItem,
  type GetFactRes,
} from "@/lib/api";

export interface FactConfidence {
  fact_id: string;
  score: number;
  reports: number;
  p_good: number;
}

export interface GetFactConfidenceRes {
  data: FactConfidence;
  meta: { msg: string };
}

export interface ListDeckConfidenceRes {
  data: { items: FactConfidence[] };
  meta: {
    msg: string;
    count?: number;
    has_more?: boolean;
    limit?: number;
    offset?: number;
    total?: number;
  };
}

export interface FactConfidenceRow {
  fact: FactItem;
  confidence: FactConfidence;
  preview: string;
}

export interface FactConfidencePage {
  rows: FactConfidenceRow[];
  hasMore: boolean;
  total: number;
  /** Offset to pass for the next page (current offset + items fetched). */
  nextOffset: number;
  limit: number;
}

export const CONFIDENCE_PAGE_SIZE = LIST_PAGINATION_DEFAULT_LIMIT;

const FACT_PREVIEW_FETCH_CONCURRENCY = 20;

/** Short text preview from the first non-empty entry. */
export function factPreview(fact: FactItem): string {
  for (const entry of fact.entries ?? []) {
    const text = entry.text?.trim();
    if (text) return text;
  }
  return "(no text)";
}

/** Lowest p_good first (weakest community confidence), then fact id. */
export function sortConfidenceRows(rows: FactConfidenceRow[]): FactConfidenceRow[] {
  return [...rows].sort((a, b) => {
    if (a.confidence.p_good !== b.confidence.p_good) {
      return a.confidence.p_good - b.confidence.p_good;
    }
    return a.fact.id.localeCompare(b.fact.id);
  });
}

export function formatPGood(pGood: number): string {
  if (!Number.isFinite(pGood)) return "—";
  return `${(pGood * 100).toFixed(1)}%`;
}

export async function getFactConfidence(
  deckId: string,
  factId: string,
  token: string
): Promise<FactConfidence> {
  const res = await request<GetFactConfidenceRes>(
    `/api/decks/${encodeURIComponent(deckId)}/facts/${encodeURIComponent(factId)}/confidence`,
    { token }
  );
  return res.data;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const idx = next;
      next += 1;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function fetchFactForPreview(
  deckId: string,
  factId: string,
  token: string
): Promise<FactItem> {
  try {
    const res = await request<GetFactRes>(
      `/api/decks/${encodeURIComponent(deckId)}/facts/${encodeURIComponent(factId)}`,
      { token }
    );
    return res.data.fact;
  } catch {
    return { id: factId, entries: [] };
  }
}

/**
 * One page of deck confidence (default 50), weakest `p_good` first deck-wide.
 * Fact text previews are loaded for the page only.
 */
export async function fetchDeckFactConfidencesPage(
  deckId: string,
  token: string,
  opts?: { limit?: number; offset?: number }
): Promise<FactConfidencePage> {
  const limit = opts?.limit ?? CONFIDENCE_PAGE_SIZE;
  const offset = opts?.offset ?? 0;
  const res = await request<ListDeckConfidenceRes>(
    `/api/decks/${encodeURIComponent(deckId)}/confidence?limit=${limit}&offset=${offset}`,
    { token }
  );
  const items = res.data.items ?? [];
  const facts = await mapPool(items, FACT_PREVIEW_FETCH_CONCURRENCY, (item) =>
    fetchFactForPreview(deckId, item.fact_id, token)
  );
  const rows: FactConfidenceRow[] = items.map((confidence, i) => {
    const fact = facts[i] ?? { id: confidence.fact_id, entries: [] };
    return {
      fact,
      confidence,
      preview: factPreview(fact),
    };
  });
  return {
    rows,
    hasMore: res.meta.has_more === true,
    total: res.meta.total ?? offset + items.length,
    nextOffset: offset + items.length,
    limit,
  };
}
