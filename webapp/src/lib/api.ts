const baseUrl = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, "") ?? "http://localhost:8080";

export function getApiBaseUrl(): string {
  return baseUrl;
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

export async function uploadMultipart(
  path: string,
  formData: FormData,
  token?: string | null
): Promise<unknown> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    body: formData,
    headers,
  });
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

export interface AddFactItemReq {
  entries: string[];
}

export interface AddFactReq {
  facts: AddFactItemReq[];
  template_indices?: number[];
}

/** Template indices for default 2-field: [0] = primary only, [0, 1] = primary + sibling. */
export function templateIndicesFromSibling(sibling: boolean): number[] {
  return sibling ? [0, 1] : [0];
}

export interface AddFactRes {
  data: { fact_length: number };
  meta: { msg: string };
}

export type AddFactOperation = "append" | "prepend" | "shuffle" | "spread";

export interface FactItem {
  id: string;
  entries: string[];
}

export interface GetFactsRes {
  data: { facts: FactItem[] };
  meta: { msg: string };
}

export interface GetFactRes {
  data: { fact: FactItem };
}

export interface UpdateFactReq {
  entries?: string[];
}

export interface UpdateFactRes {
  data: { fact_id: string };
  meta: { msg: string };
}

export interface DeleteFactRes {
  data: { fact_id: string };
  meta: { msg: string };
}

// Cards: template = [[front indices], [back indices]]
export interface NextCardItem {
  id: string;
  fact_id: string;
  template: number[][];
  last_review: number;
  due_date: number;
  hidden: boolean;
  created_at: number;
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
  template_index: number;
}
export interface AddCardForFactRes {
  data: { card_id: string };
  meta: { msg: string };
}
