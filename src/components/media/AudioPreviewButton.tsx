import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBaseUrl, notifyAuthFailure, resolveMediaFetchUrl } from "@/lib/api";
import { fetchMediaCached, MediaFetchError } from "@/lib/mediaFetchCache";

/** Play control for an in-memory audio blob (e.g. TTS proposal before upload). */
export function BlobAudioPlayButton({ mediaBlob }: { mediaBlob: Blob }) {
  return <AudioPlayButton mediaBlob={mediaBlob} />;
}

function AudioPlayButton({ mediaBlob }: { mediaBlob: Blob }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const bindAudioRef = useCallback(
    (el: HTMLAudioElement | null) => {
      if (audioRef.current && audioRef.current !== el) {
        const prev = audioRef.current;
        prev.srcObject = null;
        prev.removeAttribute("src");
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      audioRef.current = el;
      if (!el) return;

      el.removeAttribute("src");
      try {
        el.srcObject = mediaBlob;
        el.load();
      } catch {
        try {
          const u = URL.createObjectURL(mediaBlob);
          blobUrlRef.current = u;
          el.srcObject = null;
          el.src = u;
          el.load();
        } catch {
          /* leave element without playable source */
        }
      }
    },
    [mediaBlob]
  );

  return (
    <>
      <audio ref={bindAudioRef} preload="none" className="hidden" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const el = audioRef.current;
          if (!el) return;
          const canPlay = Boolean(el.srcObject || el.src || el.currentSrc);
          if (!canPlay) return;
          void el.play().catch(() => {});
        }}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-input bg-muted/50 text-foreground hover:bg-muted"
        aria-label="Play audio"
        title="Play audio"
      >
        <span className="text-[10px] leading-none" aria-hidden>
          ▶
        </span>
      </button>
    </>
  );
}

/** Fetches media by id and shows a compact play control (same blob/`srcObject` approach as card review). */
export function AudioPreviewButton({
  mediaId,
  token,
}: {
  mediaId: string;
  token: string;
}) {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState(false);
  const [loadErrMsg, setLoadErrMsg] = useState("");
  const baseUrl = getApiBaseUrl();

  useEffect(() => {
    const fetchUrl = resolveMediaFetchUrl(mediaId, baseUrl);
    let stale = false;
    setAudioBlob(null);
    setError(false);
    setLoadErrMsg("");

    void (async () => {
      try {
        const { blob } = await fetchMediaCached(fetchUrl, token, "audio");
        if (stale) return;
        setAudioBlob(blob);
      } catch (err: unknown) {
        if (stale) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (err instanceof MediaFetchError && err.status === 401) {
          notifyAuthFailure(401, fetchUrl, msg);
        }
        setLoadErrMsg(msg);
        setError(true);
      }
    })();

    return () => {
      stale = true;
    };
  }, [mediaId, token, baseUrl]);

  if (error) {
    return (
      <span className="shrink-0 text-[10px] text-muted-foreground" title={loadErrMsg || "unavailable"}>
        !
      </span>
    );
  }
  if (!audioBlob) {
    return <span className="shrink-0 text-[10px] text-muted-foreground">…</span>;
  }
  return <AudioPlayButton mediaBlob={audioBlob} />;
}
