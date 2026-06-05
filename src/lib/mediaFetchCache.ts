import { decompressApkgMediaMemberIfZstd } from "@/lib/apkgMediaBytes";

export type MediaFetchResult = {
  blob: Blob;
  mime: string;
};

export class MediaFetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "MediaFetchError";
    this.status = status;
  }
}

const completed = new Map<string, MediaFetchResult>();
const inflight = new Map<string, Promise<MediaFetchResult>>();

function mimeForKind(
  kind: "image" | "audio" | "video",
  headerMime: string,
  blobType: string
): string {
  const fallbackMime =
    kind === "audio"
      ? "audio/mpeg"
      : kind === "video"
        ? "video/mp4"
        : "image/png";
  return (
    (headerMime && headerMime !== "application/octet-stream" ? headerMime : "") ||
    (blobType && blobType !== "application/octet-stream" ? blobType : "") ||
    fallbackMime
  );
}

/**
 * Fetches deck media bytes with in-flight deduplication and a session cache.
 * Does not use AbortController so React effect cleanup (new card, Strict Mode)
 * does not show spurious "(canceled)" rows in DevTools while bytes still load.
 */
export async function fetchMediaCached(
  fetchUrl: string,
  token: string,
  kind: "image" | "audio" | "video"
): Promise<MediaFetchResult> {
  const cached = completed.get(fetchUrl);
  if (cached) {
    // #region agent log
    fetch("http://127.0.0.1:7632/ingest/fb8ff4e1-a009-4c7d-9a30-ff68fc672a10", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "acb8cb" },
      body: JSON.stringify({
        sessionId: "acb8cb",
        runId: "post-fix",
        hypothesisId: "H5",
        location: "mediaFetchCache.ts:memory-hit",
        message: "media served from session memory cache",
        data: {
          fetchUrl,
          pageOrigin: typeof window !== "undefined" ? window.location.origin : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return cached;
  }

  let promise = inflight.get(fetchUrl);
  if (!promise) {
    promise = (async (): Promise<MediaFetchResult> => {
      // #region agent log
      fetch("http://127.0.0.1:7632/ingest/fb8ff4e1-a009-4c7d-9a30-ff68fc672a10", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "acb8cb" },
        body: JSON.stringify({
          sessionId: "acb8cb",
          runId: "post-fix",
          hypothesisId: "H1-H2",
          location: "mediaFetchCache.ts:fetch-start",
          message: "media fetch starting",
          data: {
            fetchUrl,
            pageOrigin: typeof window !== "undefined" ? window.location.origin : null,
            fromMemoryCache: false,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      try {
        const res = await fetch(fetchUrl, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const ct = res.headers.get("content-type") ?? "";
        // #region agent log
        fetch("http://127.0.0.1:7632/ingest/fb8ff4e1-a009-4c7d-9a30-ff68fc672a10", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "acb8cb" },
          body: JSON.stringify({
            sessionId: "acb8cb",
            runId: "post-fix",
            hypothesisId: "H1-H4",
            location: "mediaFetchCache.ts:fetch-response",
            message: "media fetch response",
            data: {
              fetchUrl,
              pageOrigin: typeof window !== "undefined" ? window.location.origin : null,
              status: res.status,
              ok: res.ok,
              acao: res.headers.get("access-control-allow-origin"),
              cacheControl: res.headers.get("cache-control"),
              etag: res.headers.get("etag"),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        if (!res.ok) {
          let serverMsg = "";
          try {
            const j = (await res.clone().json()) as { msg?: string };
            if (typeof j.msg === "string") serverMsg = j.msg;
          } catch {
            /* ignore */
          }
          throw new MediaFetchError(serverMsg || `Failed to load: ${res.status}`, res.status);
        }
        let blob = await res.blob();
        const headerMime = ct.split(";")[0]?.trim() ?? "";
        let buf = await blob.arrayBuffer();
        buf = decompressApkgMediaMemberIfZstd(buf);
        const mime = mimeForKind(kind, headerMime, blob.type);
        blob = new Blob([buf], { type: mime });
        const result = { blob, mime };
        completed.set(fetchUrl, result);
        return result;
      } catch (err) {
        // #region agent log
        fetch("http://127.0.0.1:7632/ingest/fb8ff4e1-a009-4c7d-9a30-ff68fc672a10", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "acb8cb" },
          body: JSON.stringify({
            sessionId: "acb8cb",
            runId: "post-fix",
            hypothesisId: "H1-H3",
            location: "mediaFetchCache.ts:fetch-error",
            message: "media fetch failed",
            data: {
              fetchUrl,
              pageOrigin: typeof window !== "undefined" ? window.location.origin : null,
              errorName: err instanceof Error ? err.name : "unknown",
              errorMessage: err instanceof Error ? err.message : String(err),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        throw err;
      } finally {
        inflight.delete(fetchUrl);
      }
    })();
    inflight.set(fetchUrl, promise);
  }

  return promise;
}

/** Clears cached media (for tests). */
export function clearMediaFetchCache(): void {
  completed.clear();
  inflight.clear();
}
