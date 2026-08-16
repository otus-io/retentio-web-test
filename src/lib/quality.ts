import {
  LIST_PAGINATION_MAX_LIMIT,
  request,
} from "@/lib/api";

export interface AspectQuality {
  score: number;
  model: string;
}

export interface EntryQuality {
  text?: AspectQuality;
  audio?: AspectQuality;
}

export interface FactQuality {
  fact_id: string;
  entries: Record<string, EntryQuality>;
  updated_at: string;
}

export interface ListDeckQualityRes {
  data: { items: FactQuality[] };
  meta: {
    msg: string;
    total_entries?: number;
    has_more?: boolean;
    limit?: number;
    offset?: number;
    effective_score?: number;
  };
}

export const QUALITY_SCORE_BUCKETS = [
  { key: "1-5", label: "1–5", min: 1, max: 5 },
  { key: "6-7", label: "6–7", min: 6, max: 7 },
  { key: "8-9", label: "8–9", min: 8, max: 9 },
  { key: "10", label: "10", min: 10, max: 10 },
] as const;

export type QualityScoreBucketKey = (typeof QUALITY_SCORE_BUCKETS)[number]["key"];

export type QualityHistogram = Record<QualityScoreBucketKey, number>;

const MAX_QUALITY_PAGES_SAFETY = 100_000;

/** Worst aspect score on an entry (matches backend MinQualityScore per entry). */
export function entryMinScore(entry: EntryQuality): number | null {
  let min = 0;
  for (const aspect of [entry.text, entry.audio]) {
    if (!aspect) continue;
    if (min === 0 || aspect.score < min) min = aspect.score;
  }
  return min === 0 ? null : min;
}

export function emptyQualityHistogram(): QualityHistogram {
  return { "1-5": 0, "6-7": 0, "8-9": 0, "10": 0 };
}

/** Bucket one score into 1–5 / 6–7 / 8–9 / 10. Scores outside 1–10 are ignored. */
export function bucketForScore(score: number): QualityScoreBucketKey | null {
  for (const b of QUALITY_SCORE_BUCKETS) {
    if (score >= b.min && score <= b.max) return b.key;
  }
  return null;
}

export interface QualityEntryRow {
  factId: string;
  entryIndex: string;
  minScore: number;
  textScore: number | null;
  audioScore: number | null;
  textModel: string | null;
  audioModel: string | null;
}

/** Flat list of scored entries with aspect scores; sorted worst min score first, then fact id / index. */
export function listQualityEntries(items: FactQuality[]): QualityEntryRow[] {
  const rows: QualityEntryRow[] = [];
  for (const fact of items) {
    for (const [entryIndex, entry] of Object.entries(fact.entries ?? {})) {
      const minScore = entryMinScore(entry);
      if (minScore == null) continue;
      rows.push({
        factId: fact.fact_id,
        entryIndex,
        minScore,
        textScore: entry.text?.score ?? null,
        audioScore: entry.audio?.score ?? null,
        textModel: entry.text?.model ?? null,
        audioModel: entry.audio?.model ?? null,
      });
    }
  }
  rows.sort((a, b) => {
    if (a.minScore !== b.minScore) return a.minScore - b.minScore;
    const byFact = a.factId.localeCompare(b.factId);
    if (byFact !== 0) return byFact;
    return Number(a.entryIndex) - Number(b.entryIndex);
  });
  return rows;
}

export function entriesInBucket(
  rows: QualityEntryRow[],
  bucket: QualityScoreBucketKey
): QualityEntryRow[] {
  return rows.filter((row) => bucketForScore(row.minScore) === bucket);
}

/**
 * Counts scored entry indexes into histogram buckets using each entry's min aspect score.
 */
export function buildQualityHistogram(items: FactQuality[]): QualityHistogram {
  const hist = emptyQualityHistogram();
  for (const row of listQualityEntries(items)) {
    const key = bucketForScore(row.minScore);
    if (key) hist[key] += 1;
  }
  return hist;
}

export const QUALITY_SCORE_MIN = 1;
export const QUALITY_SCORE_MAX = 10;

export interface PutFactQualityRes {
  data: { quality: FactQuality };
  meta: { msg: string };
}

/** Clone entries with updated scores for one entry index; only aspects that already exist are updated. */
export function withUpdatedEntryScores(
  entries: Record<string, EntryQuality>,
  entryIndex: string,
  scores: { text?: number; audio?: number }
): Record<string, EntryQuality> {
  const prev = entries[entryIndex];
  if (!prev) {
    throw new Error(`entry ${entryIndex} not found`);
  }
  const entry: EntryQuality = { ...prev };
  if (scores.text != null && entry.text) {
    entry.text = { ...entry.text, score: scores.text };
  }
  if (scores.audio != null && entry.audio) {
    entry.audio = { ...entry.audio, score: scores.audio };
  }
  return { ...entries, [entryIndex]: entry };
}

/** Set every present aspect on an entry index to max score (default 10). */
export function withMaxEntryScores(
  entries: Record<string, EntryQuality>,
  entryIndex: string,
  maxScore: number = QUALITY_SCORE_MAX
): Record<string, EntryQuality> {
  const prev = entries[entryIndex];
  if (!prev) {
    throw new Error(`entry ${entryIndex} not found`);
  }
  return withUpdatedEntryScores(entries, entryIndex, {
    text: prev.text ? maxScore : undefined,
    audio: prev.audio ? maxScore : undefined,
  });
}

export async function listDeckQuality(
  deckId: string,
  token: string,
  opts?: { limit?: number; offset?: number; maxScore?: number }
): Promise<ListDeckQualityRes> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  if (opts?.maxScore != null) params.set("max_score", String(opts.maxScore));
  const qs = params.toString();
  return request<ListDeckQualityRes>(
    `/api/decks/${encodeURIComponent(deckId)}/quality${qs ? `?${qs}` : ""}`,
    { token }
  );
}

export async function putFactQuality(
  deckId: string,
  factId: string,
  entries: Record<string, EntryQuality>,
  token: string
): Promise<FactQuality> {
  const res = await request<PutFactQualityRes>(
    `/api/decks/${encodeURIComponent(deckId)}/facts/${encodeURIComponent(factId)}/quality`,
    {
      method: "PUT",
      token,
      body: JSON.stringify({ entries }),
    }
  );
  return res.data.quality;
}

export interface GetFactQualityRes {
  data: { quality: FactQuality };
  meta: { msg: string };
}

export interface DeleteFactQualityRes {
  data: { fact_id: string };
  meta: { msg: string };
}

/** GET quality; `null` when none stored (404). */
export async function getFactQuality(
  deckId: string,
  factId: string,
  token: string
): Promise<FactQuality | null> {
  try {
    const res = await request<GetFactQualityRes>(
      `/api/decks/${encodeURIComponent(deckId)}/facts/${encodeURIComponent(factId)}/quality`,
      { token }
    );
    return res.data.quality;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/quality not found/i.test(msg)) return null;
    throw e;
  }
}

export async function deleteFactQuality(
  deckId: string,
  factId: string,
  token: string
): Promise<void> {
  await request<DeleteFactQualityRes>(
    `/api/decks/${encodeURIComponent(deckId)}/facts/${encodeURIComponent(factId)}/quality`,
    { method: "DELETE", token }
  );
}

export const HUMAN_QUALITY_MODEL = "human";

export function isHumanVerifiedAspect(aspect?: AspectQuality | null): boolean {
  if (!aspect) return false;
  return aspect.score === QUALITY_SCORE_MAX && aspect.model.trim() === HUMAN_QUALITY_MODEL;
}

/**
 * True when every entry with text/audio is scored 10 by model `human` on those aspects.
 * Facts with no text and no audio are not considered verified.
 */
export function isFactHumanVerified(
  fact: { entries?: { text?: string; audio?: string }[] },
  quality: FactQuality | null | undefined
): boolean {
  const entries = fact.entries ?? [];
  let scored = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const hasText = Boolean((e?.text ?? "").trim());
    const hasAudio = Boolean((e?.audio ?? "").trim());
    if (!hasText && !hasAudio) continue;
    scored += 1;
    const q = quality?.entries?.[String(i)];
    if (hasText && !isHumanVerifiedAspect(q?.text)) return false;
    if (hasAudio && !isHumanVerifiedAspect(q?.audio)) return false;
  }
  return scored > 0;
}

/** Merge existing quality with human/10 for every entry that has text and/or audio. */
export function buildHumanVerifiedEntries(
  fact: { entries?: { text?: string; audio?: string }[] },
  existing: Record<string, EntryQuality> = {}
): Record<string, EntryQuality> {
  const out: Record<string, EntryQuality> = {};
  for (const [key, entry] of Object.entries(existing)) {
    out[key] = {
      ...(entry.text ? { text: { ...entry.text } } : {}),
      ...(entry.audio ? { audio: { ...entry.audio } } : {}),
    };
  }
  const entries = fact.entries ?? [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const hasText = Boolean((e?.text ?? "").trim());
    const hasAudio = Boolean((e?.audio ?? "").trim());
    if (!hasText && !hasAudio) continue;
    const key = String(i);
    const prev = out[key] ?? {};
    const next: EntryQuality = {};
    if (hasText) next.text = { score: QUALITY_SCORE_MAX, model: HUMAN_QUALITY_MODEL };
    else if (prev.text) next.text = prev.text;
    if (hasAudio) next.audio = { score: QUALITY_SCORE_MAX, model: HUMAN_QUALITY_MODEL };
    else if (prev.audio) next.audio = prev.audio;
    out[key] = next;
  }
  return out;
}

/** Drop aspects marked human/10; omit entry keys left with no aspects. */
export function stripHumanVerifiedAspects(
  entries: Record<string, EntryQuality>
): Record<string, EntryQuality> {
  const out: Record<string, EntryQuality> = {};
  for (const [key, entry] of Object.entries(entries)) {
    const next: EntryQuality = {};
    if (entry.text && !isHumanVerifiedAspect(entry.text)) next.text = entry.text;
    if (entry.audio && !isHumanVerifiedAspect(entry.audio)) next.audio = entry.audio;
    if (next.text || next.audio) out[key] = next;
  }
  return out;
}

/** Loads every quality fact for a deck (pages at max limit until has_more is false). */
export async function fetchAllDeckQuality(
  deckId: string,
  token: string,
  opts?: { maxScore?: number }
): Promise<FactQuality[]> {
  const pageSize = LIST_PAGINATION_MAX_LIMIT;
  const out: FactQuality[] = [];
  let offset = 0;
  for (let page = 0; ; page += 1) {
    if (page > MAX_QUALITY_PAGES_SAFETY) {
      throw new Error("quality list: exceeded maximum pages");
    }
    const res = await listDeckQuality(deckId, token, {
      limit: pageSize,
      offset,
      maxScore: opts?.maxScore,
    });
    const batch = res.data.items ?? [];
    out.push(...batch);
    if (res.meta.has_more !== true) break;
    offset += batch.length;
    if (batch.length === 0) break;
  }
  return out;
}
