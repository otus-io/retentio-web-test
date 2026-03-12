const baseUrl = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, "") ?? "http://localhost:8080";

export function getApiBaseUrl(): string {
  return baseUrl;
}

/** Send a debug log line to the backend; backend appends to logs/debug.log at repo root (see .cursor/rules/debug-logging.mdc). */
export function debugLog(payload: Record<string, unknown>): void {
  fetch(`${baseUrl}/api/dev/debug-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export interface ApiError {
  msg?: string;
}

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return (body as ApiError).msg ?? res.statusText;
}

export async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(await parseError(res));
  const text = await res.text();
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

const UPLOAD_TIMEOUT_MS = 120_000; // 2 min — backend may run ffmpeg/cwebp

/** Optional client_id enables idempotent uploads (backend returns existing media if already uploaded). */
export async function uploadMultipart(
  path: string,
  formData: FormData,
  token?: string | null,
  clientId?: string | null
): Promise<unknown> {
  if (clientId) formData.append("client_id", clientId);
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), UPLOAD_TIMEOUT_MS);
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      body: formData,
      headers,
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Upload timed out. Try a smaller file or try again.");
    }
    throw err;
  }
  clearTimeout(timeoutId);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export interface LoginRes {
  data: { token: string };
  meta: { expires: string };
}

export interface RegisterRes {
  data: { username: string; email: string };
  meta: { created_at: string };
}

export interface MediaItem {
  id: string;
  owner: string;
  filename: string;
  mime: string;
  size: number;
  checksum: string;
  created_at: number;
}

export interface ListMediaRes {
  data: MediaItem[];
  meta: { count: number; has_more: boolean };
}

export interface UploadMediaRes {
  data: MediaItem;
  meta: { msg: string };
}

export interface ProfileRes {
  data: { username: string; email: string };
  meta?: { created_at: string };
}

export interface DeckStats {
  cards_count: number;
  due_cards: number;
  facts_count: number;
  hidden_cards: number;
  last_reviewed_at?: number;
  new_cards_today: number;
  reviewed_cards: number;
  unseen_cards: number;
}

export interface DeckItem {
  id: string;
  name: string;
  owner: string;
  field: string[];
  rate: number;
  stats: DeckStats;
  created_at: string;
  updated_at: string;
}

export interface GetDecksRes {
  data: { decks: DeckItem[] };
  meta: { msg: string; total: string };
}

export interface CreateDeckReq {
  name: string;
  fields: string[];
  rate?: number;
}

export interface UpdateDeckReq {
  name?: string;
  fields?: string[];
  rate?: number;
}

export interface GetDeckRes {
  data: DeckItem;
  meta: { msg: string };
}

export interface CreateDeckRes {
  data: { deck_id: string };
  meta: { msg: string };
}

export interface UpdateDeckRes {
  data: { deck_id: string };
  meta: { msg: string; updated_at?: string };
}

export interface DeleteDeckRes {
  data: { deck_id: string };
  meta: { msg: string };
}

/** One slot of a fact: optional text, audio, image, video (at least one required). */
export interface Entry {
  text?: string;
  audio?: string;
  image?: string;
  video?: string;
}

export interface AddFactItemReq {
  entries: Entry[];
  /** Optional column names; length must equal entries. When omitted, deck default fields are used. */
  fields?: string[];
}

/**
 * Add-fact API (POST /api/decks/{id}/facts/{operation}): body is facts and optional template.
 * To add a card from an existing fact, use POST /api/decks/{id}/card with AddCardForFactReq.
 */
export interface AddFactReq {
  facts: AddFactItemReq[];
  /** When sibling is true, send two templates: [[front, back], [back, front]]. Omit for one card per fact. */
  template?: number[][][];
}

/** Body for POST /api/decks/{id}/card (add one card from an existing fact). fact_id and template required; optional operation (default append). */
export interface AddCardForFactReq {
  fact_id: string;
  template: number[][];
}

/** Validates add-fact body: facts array is required. Returns error message or null if valid. */
export function validateAddFactBody(p: { hasFacts: boolean }): string | null {
  if (!p.hasFacts) return "Facts array is required.";
  return null;
}

/** Format one entry for display (e.g. in fact list). Prefers text; otherwise "audio:id" / "image:id" / "video:id". */
export function entryToDisplayString(entry: Entry): string {
  if (entry.text != null && entry.text !== "") return entry.text;
  if (entry.audio) return `audio:${entry.audio}`;
  if (entry.image) return `image:${entry.image}`;
  if (entry.video) return `video:${entry.video}`;
  return "";
}

/** Returns { template } for AddFactReq when needed; otherwise {}. */
export function buildTemplateForRequest(
  fieldCount: number,
  split: number,
  sibling: boolean
): { template?: number[][][] } {
  if (fieldCount < 1) return {};
  if (sibling) return { template: buildSiblingTemplate(fieldCount, split) };
  if (split !== 1) return { template: [buildTemplateWithSplit(fieldCount, split)] };
  return {};
}
export function buildTemplateWithSplit(fieldCount: number, split: number): number[][] {
  if (fieldCount < 1 || split < 1) {
    const front = [0];
    const back = Array.from({ length: fieldCount - 1 }, (_, i) => i + 1);
    return [front, back];
  }
  if (split >= fieldCount) {
    const front = Array.from({ length: fieldCount }, (_, i) => i);
    return [front, []];
  }
  const front = Array.from({ length: split }, (_, i) => i);
  const back = Array.from({ length: fieldCount - split }, (_, i) => i + split);
  return [front, back];
}

/** Returns two templates for n fields with given split: primary [front, back] and reversed [back, front]. */
export function buildSiblingTemplate(fieldCount: number, split = 1): number[][][] {
  if (fieldCount < 1) return [];
  const [front, back] = buildTemplateWithSplit(fieldCount, split);
  return [
    [front, back],
    [back.slice(), front.slice()],
  ];
}

export interface AddFactRes {
  data: { fact_length: number };
  meta: { msg: string };
}

export type AddFactOperation = "append" | "prepend" | "shuffle" | "spread";

export interface FactItem {
  id: string;
  entries: Entry[];
}

export interface GetFactsRes {
  data: { facts: FactItem[] };
  meta: { msg: string };
}

export interface GetFactRes {
  data: { fact: FactItem };
}

export interface UpdateFactReq {
  entries?: Entry[];
}

export interface UpdateFactRes {
  data: { fact_id: string };
  meta: { msg: string };
}

export interface DeleteFactRes {
  data: { fact_id: string };
  meta: { msg: string };
}

// One item in a card entry: type + value (text content or media URL).
export interface CardEntryItem {
  type: "text" | "audio" | "image" | "video";
  value: string;
}

// One entry on front/back: optional field label + items (typed content). Order follows template.
export interface CardEntry {
  field?: string;
  items: CardEntryItem[];
}

// Cards: template = [[front indices], [back indices]]; front/back are arrays of CardEntry (back may be []).
export interface NextCardItem {
  id: string;
  fact_id: string;
  template: number[][];
  last_review: number;
  due_date: number;
  hidden: boolean;
  created_at: number;
  front: CardEntry[];
  back: CardEntry[];
}

export interface GetNextCardRes {
  data: { card: NextCardItem; urgency: number };
  meta?: {
    msg?: string;
    reschedule_suggested?: boolean;
    suggested_reschedule_days?: number;
    earliest_overdue_due_date?: number;
    overdue_cards?: number;
  };
}

export interface GetCardsRes {
  data: {
    total_cards: number;
    hidden_count: number;
    hidden_facts: FactItem[];
    orphaned_hidden_cards?: number;
  };
  meta: { msg: string };
}

export interface UpdateCardReq {
  card_id: string;
  interval?: number;
  last_review?: number;
  hidden?: boolean;
}

export interface UpdateCardRes {
  data: { due_date?: number; hidden_status?: boolean; last_review?: number; new_interval?: number };
  meta: { msg: string };
}
export interface RescheduleReq {
  days: number;
}
export interface RescheduleRes {
  data?: { msg?: string };
  meta?: { msg: string };
}
export interface ForgotPasswordReq {
  email: string;
}
export interface ResetPasswordReq {
  token: string;
  new_password: string;
}
export interface AddCardForFactReq {
  fact_id: string;
  /** [[front indices], [back indices]], e.g. [[0],[1]] or [[1],[0]] for reversed. */
  template: number[][];
}
export interface AddCardForFactRes {
  data: { card_id: string };
  meta: { msg: string };
}
