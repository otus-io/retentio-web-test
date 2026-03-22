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

/** Long timeout for bulk ZIP import (~500MB transfer + many media files on server). */
export const BULK_IMPORT_UPLOAD_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

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
        ? "Upload progress reported 100% of the body sent; failure likely while waiting for HTTP response — e.g. API/proxy timeout, max body/time limit, server OOM/crash during bulk-import, or connection reset. Check API and reverse-proxy logs."
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

export interface BulkImportRes {
  data: { facts_added: number; media_uploaded: number };
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
  /** Omit or use [] for an empty deck; field names can be set later (e.g. Bulk Upload CSV header). */
  fields?: string[];
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

// One item for rendering a next-card face slot: type + value (text or media URL).
export interface CardEntryItem {
  type: "text" | "audio" | "image" | "video";
  value: string;
}

/** One template slot on GET next card front/back: optional field + optional text/audio/image/video (same as fact entry keys). */
export interface CardEntry {
  field?: string;
  text?: string;
  audio?: string;
  image?: string;
  video?: string;
}

/** Expands a CardEntry to ordered render pieces: text, then audio, image, video. */
export function cardEntryToRenderItems(entry: CardEntry): CardEntryItem[] {
  const out: CardEntryItem[] = [];
  if (entry.text) out.push({ type: "text", value: entry.text });
  if (entry.audio) out.push({ type: "audio", value: entry.audio });
  if (entry.image) out.push({ type: "image", value: entry.image });
  if (entry.video) out.push({ type: "video", value: entry.video });
  return out;
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
