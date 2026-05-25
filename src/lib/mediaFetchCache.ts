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
  if (cached) return cached;

  let promise = inflight.get(fetchUrl);
  if (!promise) {
    promise = (async (): Promise<MediaFetchResult> => {
      try {
        const res = await fetch(fetchUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const ct = res.headers.get("content-type") ?? "";
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
