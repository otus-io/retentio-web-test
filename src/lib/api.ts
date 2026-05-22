const baseUrl = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, "") ?? "http://localhost:8080";

/** True when upload failures should log details (browser console + optional agent ingest). */
const debugUpload =
  import.meta.env.DEV || String(import.meta.env.VITE_DEBUG_UPLOAD ?? "") === "true";

// #region agent log
function ingestUploadDebug(payload: Record<string, unknown>): void {
  if (!debugUpload || typeof window === "undefined") return;
  fetch("http://127.0.0.1:7897/ingest/cdc1917e-6ca0-4c9a-ad91-28c529ea507b", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "e56295",
    },
    body: JSON.stringify({
      sessionId: "e56295",
      timestamp: Date.now(),
      ...payload,
    }),
  }).catch(() => {});
}
// #endregion

function apiHostLabel(fullUrl: string): string {
  try {
    return new URL(fullUrl).host;
  } catch {
    return "API";
  }
}

/** Approximate body size and a short preview of FormData parts (for upload diagnostics). */
function summarizeFormData(form: FormData): {
  approxPayloadBytes: number;
  formDataPartCount: number;
  formDataPartsPreview: { name: string; kind: string; size?: number }[];
} {
  const preview: { name: string; kind: string; size?: number }[] = [];
  let approxPayloadBytes = 0;
  let partCount = 0;
  for (const [name, value] of form.entries()) {
    partCount += 1;
    const v: unknown = value;
    if (v instanceof File) {
      approxPayloadBytes += v.size;
      if (preview.length < 10) preview.push({ name, kind: "file", size: v.size });
    } else if (v instanceof Blob) {
      approxPayloadBytes += v.size;
      if (preview.length < 10) preview.push({ name, kind: "blob", size: v.size });
    } else {
      const n = new Blob([String(v)]).size;
      approxPayloadBytes += n;
      if (preview.length < 10) preview.push({ name, kind: "field", size: n });
    }
  }
  return { approxPayloadBytes, formDataPartCount: partCount, formDataPartsPreview: preview };
}

function urlDiagnostics(fullUrl: string): Record<string, unknown> {
  try {
    const u = new URL(fullUrl);
    const defaultPort = u.protocol === "https:" ? "443" : u.protocol === "http:" ? "80" : "";
    return {
      urlHostname: u.hostname,
      urlPort: u.port || defaultPort || "",
      urlPathname: u.pathname,
      urlProtocol: u.protocol,
    };
  } catch {
    return { urlParseFailed: true };
  }
}

function browserUploadContext(): Record<string, unknown> {
  if (typeof navigator === "undefined") return {};
  type NavConn = Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  };
  const nav = navigator as NavConn;
  const c = nav.connection;
  return {
    navigatorOnLine: nav.onLine,
    visibilityState: typeof document !== "undefined" ? document.visibilityState : undefined,
    userAgentSnippet: nav.userAgent?.slice(0, 160),
    connectionEffectiveType: c?.effectiveType,
    connectionDownlinkMbps: c?.downlink,
    connectionRttMs: c?.rtt,
    saveData: c?.saveData,
  };
}

function xhrWireDiagnostics(xhr: XMLHttpRequest, requestUrl: string): Record<string, unknown> {
  let responseHeaders = "";
  try {
    responseHeaders = xhr.getAllResponseHeaders() ?? "";
  } catch {
    responseHeaders = "(getAllResponseHeaders failed)";
  }
  return {
    ...urlDiagnostics(requestUrl),
    xhrStatus: xhr.status,
    xhrStatusText: xhr.statusText,
    xhrReadyState: xhr.readyState,
    xhrResponseURL: xhr.responseURL || null,
    responseHeadersLength: responseHeaders.length,
    responseHeadersPreview: responseHeaders ? responseHeaders.slice(0, 600) : null,
  };
}

/** True when upload progress reported the full body sent (XHR may still fail while awaiting the response). */
function xhrUploadPhaseComplete(
  last: { loaded: number; total: number; lengthComputable: boolean } | null
): boolean {
  if (!last?.lengthComputable || last.total <= 0) return false;
  // Small slack: multipart boundaries can make loaded slightly differ from FormData byte estimate.
  return last.loaded >= last.total - 4096;
}

function logUploadFailure(
  hypothesisId: string,
  kind: string,
  path: string,
  fullUrl: string,
  extra: Record<string, unknown>,
  logImpl: (...args: unknown[]) => void = console.warn
): void {
  const data = {
    kind,
    path,
    fullUrl,
    baseUrl,
    pageOrigin: typeof window !== "undefined" ? window.location.origin : "",
    apiScheme: (() => {
      try {
        return new URL(fullUrl).protocol;
      } catch {
        return "invalid-url";
      }
    })(),
    ...extra,
  };
  logImpl(`[api upload] ${kind}`, data);
  ingestUploadDebug({
    hypothesisId,
    location: "api.ts:upload",
    message: kind,
    data,
  });
}

export function getApiBaseUrl(): string {
  return baseUrl;
}

/**
 * Build a media download URL against the configured API (not the host embedded in card/fact responses).
 * Handles bare ids, `id?v=N`, and absolute `https://…/api/media/{id}?v=N` from GET /card.
 */
export function resolveMediaFetchUrl(idOrUrl: string, apiBase: string = baseUrl): string {
  const trimmed = idOrUrl.trim();
  const root = apiBase.replace(/\/$/, "");
  if (!trimmed) return `${root}/api/media/`;

  let mediaId = trimmed;
  let version: string | null = null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const u = new URL(trimmed);
      const match = u.pathname.match(/\/api\/media\/([^/]+)$/);
      if (match) {
        mediaId = match[1];
        version = u.searchParams.get("v");
      } else {
        return trimmed;
      }
    } catch {
      return trimmed;
    }
  } else if (trimmed.includes("?")) {
    const q = trimmed.indexOf("?");
    mediaId = trimmed.slice(0, q);
    version = new URLSearchParams(trimmed.slice(q + 1)).get("v");
  }

  const path = `${root}/api/media/${mediaId}`;
  return version ? `${path}?v=${encodeURIComponent(version)}` : path;
}

/** Strip full media URLs to stored id form (`mediaId` or `mediaId?v=N`). */
export function normalizeStoredMediaRef(value: string | undefined): string | undefined {
  if (value == null || !String(value).trim()) return value;
  const trimmed = String(value).trim();
  if (trimmed.startsWith("shared:")) return trimmed;
  const resolved = resolveMediaFetchUrl(trimmed, "http://local");
  try {
    const u = new URL(resolved);
    const match = u.pathname.match(/\/api\/media\/([^/]+)$/);
    if (!match) return trimmed;
    const id = match[1];
    const v = u.searchParams.get("v");
    return v ? `${id}?v=${v}` : id;
  } catch {
    return trimmed;
  }
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
  clientId?: string | null,
  timeoutMs: number = UPLOAD_TIMEOUT_MS
): Promise<unknown> {
  if (clientId) formData.append("client_id", clientId);
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs);
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
    const fullUrl = `${baseUrl}${path}`;
    logUploadFailure(
      "H_fetch",
      "fetch upload threw (offline/CORS/mixed-content?)",
      path,
      fullUrl,
      {
        errName: err instanceof Error ? err.name : typeof err,
        errMessage: err instanceof Error ? err.message : String(err),
        ...browserUploadContext(),
        ...summarizeFormData(formData),
      },
      console.error
    );
    throw err;
  }
  clearTimeout(timeoutId);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/**
 * Same as {@link uploadMultipart} but reports upload progress via XMLHttpRequest (fetch has no upload progress).
 * `onProgress` receives 0–100 while bytes are sent; may not fire if the browser cannot compute total size.
 */
export function uploadMultipartWithProgress(
  path: string,
  formData: FormData,
  token?: string | null,
  clientId?: string | null,
  timeoutMs: number = UPLOAD_TIMEOUT_MS,
  onProgress?: (percent: number) => void
): Promise<unknown> {
  if (clientId) formData.append("client_id", clientId);
  const url = `${baseUrl}${path}`;
  const payloadSummary = summarizeFormData(formData);
  const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
  let lastUpload: { loaded: number; total: number; lengthComputable: boolean } | null = null;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.timeout = timeoutMs;
    if (debugUpload) {
      console.debug("[api upload] XHR start", { path, url, timeoutMs, ...payloadSummary });
    }
    xhr.upload.onprogress = (e) => {
      lastUpload = {
        loaded: e.loaded,
        total: e.total,
        lengthComputable: e.lengthComputable,
      };
      if (e.lengthComputable && e.total > 0 && onProgress) {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      const elapsedSinceOpenMs =
        typeof performance !== "undefined" ? Math.round(performance.now() - startedAt) : undefined;
      const text = xhr.responseText ?? "";
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          if (!text.trim()) resolve({});
          else resolve(JSON.parse(text));
        } catch {
          reject(new Error("Invalid JSON response"));
        }
        return;
      }
      let msg = xhr.statusText || "Request failed";
      try {
        const body = JSON.parse(text) as ApiError;
        if (body.msg) msg = body.msg;
      } catch {
        if (text.trim()) msg = text;
      }
      logUploadFailure("H_http_status", "XHR completed with error status", path, url, {
        status: xhr.status,
        statusText: xhr.statusText,
        responseLen: text.length,
        responsePreview: text.slice(0, 400),
        elapsedSinceOpenMs,
        lastUploadProgress: lastUpload,
        ...payloadSummary,
        ...browserUploadContext(),
        ...xhrWireDiagnostics(xhr, url),
      });
      reject(new Error(msg));
    };
    xhr.onerror = () => {
      const elapsedSinceOpenMs =
        typeof performance !== "undefined" ? Math.round(performance.now() - startedAt) : undefined;
      const afterFullUpload = xhrUploadPhaseComplete(lastUpload);
      const kind = afterFullUpload
        ? "XHR onerror after upload finished (awaiting response)"
        : "XHR onerror (TLS/CORS/DNS/connection drop)";
      const failureHint = afterFullUpload
        ? "Upload progress reported 100% of the body sent; failure likely while waiting for HTTP response — e.g. API/proxy timeout, max body/time limit, server OOM/crash while processing the upload, or connection reset. Check API and reverse-proxy logs."
        : "JS cannot read net::ERR_* (e.g. ERR_CONNECTION_REFUSED). DevTools → Network → select this request → read the Status / error text.";
      logUploadFailure(
        afterFullUpload ? "H_xhr_after_upload" : "H_xhr_network",
        kind,
        path,
        url,
        {
          ...xhrWireDiagnostics(xhr, url),
          ...browserUploadContext(),
          ...payloadSummary,
          elapsedSinceOpenMs,
          lastUploadProgress: lastUpload,
          timeoutConfiguredMs: timeoutMs,
          uploadPhaseReportedComplete: afterFullUpload,
          note: failureHint,
        },
        console.error
      );
      const host = apiHostLabel(url);
      if (afterFullUpload && lastUpload && lastUpload.total > 0) {
        const mb = Math.max(1, Math.round(lastUpload.total / (1024 * 1024)));
        reject(
          new Error(
            `Upload finished (~${mb} MB) but the connection dropped before a response. Often the API or a proxy timed out, rejected large bodies, or crashed while processing (check server logs). Host: ${host}.`
          )
        );
        return;
      }
      reject(
        new Error(
          `Network error (${host}). Open DevTools → Network for the failed request; see [api upload] in the console for details.`
        )
      );
    };
    xhr.ontimeout = () => {
      const elapsedSinceOpenMs =
        typeof performance !== "undefined" ? Math.round(performance.now() - startedAt) : undefined;
      logUploadFailure(
        "H_timeout",
        "XHR timeout",
        path,
        url,
        {
          timeoutMs,
          elapsedSinceOpenMs,
          lastUploadProgress: lastUpload,
          ...payloadSummary,
          ...browserUploadContext(),
          ...xhrWireDiagnostics(xhr, url),
        },
        console.error
      );
      reject(new Error("Upload timed out. Try a smaller file or try again."));
    };
    xhr.send(formData);
  });
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
  fields: string[];
  rate: number;
  stats: DeckStats;
  created_at: string;
  updated_at: string;
  /** Source deck: private | public (import gate). */
  visibility?: string;
  /** Source deck: latest published snapshot version; 0 = never published. */
  published_version?: number;
  /** Import deck: author's source deck id. */
  source_deck_id?: string;
  /** Import deck: pinned snapshot version. */
  source_version?: number;
  /** Import deck: when the import was created. */
  imported_at?: string;
  /** Import deck: source author's latest published_version (from GET /decks or GET /decks/{id}). */
  latest_source_version?: number;
  /** Import deck: true when source_version < latest_source_version. */
  source_update_available?: boolean;
}

/** True when this deck is an imported study copy (read-only facts). */
export function isImportedDeck(deck: Pick<DeckItem, "source_deck_id">): boolean {
  return Boolean(deck.source_deck_id?.trim());
}

/** True when a source deck has ever been published (deletion lock applies). */
export function isPublishedSourceDeck(deck: Pick<DeckItem, "published_version">): boolean {
  return (deck.published_version ?? 0) > 0;
}

export interface PublishDeckReq {
  visibility?: string;
}

export interface PublishDeckRes {
  data: { published_version: number; visibility: string };
  meta: { msg: string };
}

export interface ImportDeckReq {
  source_deck_id: string;
}

export interface ImportDeckRes {
  data: {
    id: string;
    source_deck_id: string;
    source_version: number;
    imported_at: string;
  };
  meta: { msg: string };
}

export interface DeckUpdateFactRef {
  fact_id: string;
}

export interface DeckUpdateEditedFact {
  fact_id: string;
  before?: FactItem;
  after?: FactItem;
}

export interface DeckUpdateMediaChange {
  media_id: string;
  before_hash?: string;
  after_hash?: string;
  before_bytes?: number;
  after_bytes?: number;
}

export interface DeckUpdatesData {
  source_version: number;
  latest_version: number;
  added_facts: DeckUpdateFactRef[];
  removed_facts: DeckUpdateFactRef[];
  edited_facts: DeckUpdateEditedFact[];
  media_changes: DeckUpdateMediaChange[];
  change_summary?: string;
}

export interface GetDeckUpdatesRes {
  data: DeckUpdatesData;
  meta: { msg: string };
}

export interface SyncDeckReq {
  target_version?: number;
}

export interface SyncDeckRes {
  data: { source_version: number };
  meta: { msg: string };
}

export function deckHasUpdatesAvailable(updates: DeckUpdatesData): boolean {
  const pinned = updates.source_version ?? 0;
  const latest = updates.latest_version ?? 0;
  return pinned < latest;
}

/** Whether an imported deck has a newer published snapshot (from deck row or /updates). */
export function importedDeckUpdateAvailable(deck: Pick<DeckItem, "source_deck_id" | "source_version" | "latest_source_version" | "source_update_available">): boolean {
  if (!isImportedDeck(deck)) return false;
  if (typeof deck.source_update_available === "boolean") {
    return deck.source_update_available;
  }
  const pinned = deck.source_version ?? 0;
  const latest = deck.latest_source_version;
  if (typeof latest === "number") return pinned < latest;
  return false;
}

export async function publishDeck(
  deckId: string,
  body: PublishDeckReq,
  token: string
): Promise<PublishDeckRes> {
  return request<PublishDeckRes>(`/api/decks/${deckId}/publish`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function importDeck(body: ImportDeckReq, token: string): Promise<ImportDeckRes> {
  return request<ImportDeckRes>("/api/decks/import", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function getDeckUpdates(importDeckId: string, token: string): Promise<GetDeckUpdatesRes> {
  return request<GetDeckUpdatesRes>(`/api/decks/${importDeckId}/updates`, { token });
}

export async function syncDeck(
  importDeckId: string,
  body: SyncDeckReq,
  token: string
): Promise<SyncDeckRes> {
  return request<SyncDeckRes>(`/api/decks/${importDeckId}/sync`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export interface GetDecksRes {
  data: { decks: DeckItem[] };
  meta: { msg: string; total: string };
}

export interface CreateDeckReq {
  name: string;
  /** Omit or use [] for an empty deck; field names can be set later (e.g. deck edit or import). */
  fields?: string[];
  rate?: number;
}

export interface UpdateDeckReq {
  name?: string;
  fields?: string[];
  rate?: number;
  /** Source deck only, before first publish. */
  visibility?: string;
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

/** True when a file should be uploaded as JSON media (MIME or .json extension). */
export function fileLooksLikeJson(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "application/json" || t === "text/json") return true;
  return file.name.toLowerCase().endsWith(".json");
}

/** One slot of a fact: optional text, audio, image, video, json (at least one required). */
export interface Entry {
  text?: string;
  audio?: string;
  image?: string;
  video?: string;
  json?: string;
}

export interface AddFactItemReq {
  entries: Entry[];
  /** Optional fact tag names (server resolves/creates and associates to the fact). */
  tags?: string[];
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

/** Format one entry for display (e.g. in fact list). Prefers text; otherwise "audio:id" / "image:id" / "video:id" / "json:id". */
export function entryToDisplayString(entry: Entry): string {
  if (entry.text != null && entry.text !== "") return entry.text;
  if (entry.audio) return `audio:${entry.audio}`;
  if (entry.image) return `image:${entry.image}`;
  if (entry.video) return `video:${entry.video}`;
  if (entry.json) return `json:${entry.json}`;
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
  meta: {
    msg: string;
    count?: number;
    has_more?: boolean;
    limit?: number;
    offset?: number;
    /** Total facts in the deck for this list (paged GET /facts). */
    total?: number;
  };
}

/** Matches retentio-backend `api/helpers/list_pagination.go`. */
export const LIST_PAGINATION_DEFAULT_LIMIT = 50;
export const LIST_PAGINATION_MAX_LIMIT = 200;

const MAX_LIST_PAGES_SAFETY = 100_000;

/**
 * One page of facts from GET /api/decks/{id}/facts (default limit 50, offset 0).
 */
export async function fetchDeckFactsPage(
  deckId: string,
  token: string,
  opts?: { limit?: number; offset?: number }
): Promise<GetFactsRes> {
  const limit = opts?.limit ?? LIST_PAGINATION_DEFAULT_LIMIT;
  const offset = opts?.offset ?? 0;
  return request<GetFactsRes>(
    `/api/decks/${encodeURIComponent(deckId)}/facts?limit=${limit}&offset=${offset}`,
    { token }
  );
}

/** Full deck facts in one response (omit limit/offset). Prefer paging for large decks. */
export async function fetchDeckFactsUnpaginated(deckId: string, token: string): Promise<GetFactsRes> {
  return request<GetFactsRes>(`/api/decks/${encodeURIComponent(deckId)}/facts`, { token });
}

/**
 * Loads every fact in a deck using GET /api/decks/{id}/facts with limit/offset paging
 * (page size {@link LIST_PAGINATION_DEFAULT_LIMIT}, same as list media). Safe for large decks; stops when meta.has_more is not true.
 */
export async function fetchAllDeckFacts(deckId: string, token: string): Promise<FactItem[]> {
  const pageSize = LIST_PAGINATION_DEFAULT_LIMIT;
  const out: FactItem[] = [];
  let offset = 0;
  for (let page = 0; ; page += 1) {
    if (page > MAX_LIST_PAGES_SAFETY) {
      throw new Error("facts list: exceeded maximum pages");
    }
    const res = await fetchDeckFactsPage(deckId, token, { limit: pageSize, offset });
    const batch = res.data.facts;
    out.push(...batch);
    if (res.meta.has_more !== true) break;
    offset += batch.length;
    if (batch.length === 0) break;
  }
  return out;
}

/**
 * Loads all user-owned media via GET /api/media with limit/offset until has_more is false.
 */
export async function fetchAllUserMedia(token: string): Promise<MediaItem[]> {
  const pageSize = LIST_PAGINATION_DEFAULT_LIMIT;
  const out: MediaItem[] = [];
  let offset = 0;
  for (let page = 0; ; page += 1) {
    if (page > MAX_LIST_PAGES_SAFETY) {
      throw new Error("media list: exceeded maximum pages");
    }
    const res = await request<ListMediaRes>(`/api/media?limit=${pageSize}&offset=${offset}`, { token });
    const batch = res.data;
    out.push(...batch);
    if (res.meta.has_more !== true) break;
    offset += batch.length;
    if (batch.length === 0) break;
  }
  return out;
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

// One item for rendering a next-card face slot: type + value (text or media URL).
export interface CardEntryItem {
  type: "text" | "audio" | "image" | "video" | "json";
  value: string;
}

/** One template slot on GET next card front/back: optional field + optional text/audio/image/video/json (same as fact entry keys). */
export interface CardEntry {
  field?: string;
  text?: string;
  audio?: string;
  image?: string;
  video?: string;
  json?: string;
}

/** Expands a CardEntry to ordered render pieces: text, then audio, image, video, json. */
export function cardEntryToRenderItems(entry: CardEntry): CardEntryItem[] {
  const out: CardEntryItem[] = [];
  if (entry.text) out.push({ type: "text", value: entry.text });
  if (entry.audio) out.push({ type: "audio", value: entry.audio });
  if (entry.image) out.push({ type: "image", value: entry.image });
  if (entry.video) out.push({ type: "video", value: entry.video });
  if (entry.json) out.push({ type: "json", value: entry.json });
  return out;
}

// Cards: template = [[front indices], [back indices]]; front/back are arrays of CardEntry (back may be []).
// Scheduling numbers (last_review, due_date, created_at; deck stats last_reviewed_at) are Unix seconds since UTC epoch.
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

/** Card row from `GET /api/decks/{id}/cards` (same shape as stored card, no front/back). */
export interface DeckCardListItem {
  id: string;
  fact_id: string;
  template: number[][];
  last_review: number;
  due_date: number;
  hidden: boolean;
  created_at: number;
}

/** Response from `GET /api/decks/{id}/cards` — full card list plus aggregate counts and filter lists (server-derived). */
export interface GetCardsRes {
  data: {
    total_cards: number;
    hidden_cards_count: number;
    due_cards: number;
    due_cards_list: DeckCardListItem[];
    unseen_cards: number;
    hidden_cards_list: DeckCardListItem[];
    unseen_cards_list: DeckCardListItem[];
    seen_cards_list: DeckCardListItem[];
    cards: DeckCardListItem[];
    orphaned_hidden_cards?: number;
  };
  meta: { msg?: string };
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
