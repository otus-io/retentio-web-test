import { useState, useMemo, useEffect, useRef, useCallback, Fragment, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { CardEntry, DeckItem, Entry, FactItem } from "@/lib/api";
import { cardEntryToRenderItems, type CardEntryItem, type GetNextCardRes } from "@/lib/api";
import type { DeckCardSidesTypography } from "@/lib/deckCardTypography";
import { DECK_CARD_TYPOGRAPHY_DEFAULTS } from "@/lib/deckCardTypography";
import { getApiBaseUrl, notifyAuthFailure, resolveMediaFetchUrl } from "@/lib/api";
import { fetchMediaCached, MediaFetchError } from "@/lib/mediaFetchCache";
import { AddCardFromFactModal } from "./AddCardFromFactModal";
import { formatMediaMarkersForDisplay } from "@/lib/utils";
import { looksLikeWikiRubyMarkup, parseWikiRubyMarkup } from "@/lib/wikiRubyMarkup";
import { formatUnixSecondsUtc, nowUnixSecondsUtc } from "@/lib/unixTime";
import { reviewIntervalRangeFromTimestamps } from "@/lib/reviewIntervalRange";
import { formatReviewIntervalLabel } from "@/lib/reviewIntervalLabel";

// Marker format: [audio:id], [image:id], [video:id], [json:id] (API). Also bare "type:id". Ids: alphanumeric, _, :, -, .
const MEDIA_MARKER_RE = /\[(audio|image|video|json):([^\]]+)\]/g;
// Bare markers — do not match when already inside brackets (e.g. "[image:id]").
const BARE_MEDIA_MARKER_RE = /\b(audio|image|video|json):([a-zA-Z0-9_:.-]+)/g;

function normalizeMediaMarkers(text: string): string {
  return text.replace(BARE_MEDIA_MARKER_RE, (match, type, id, offset) => {
    if (offset > 0 && text[offset - 1] === "[") return match;
    return `[${type}:${id}]`;
  });
}

type FieldSegment =
  | { kind: "text"; value: string }
  | { kind: "image"; id: string }
  | { kind: "audio"; id: string }
  | { kind: "video"; id: string }
  | { kind: "json"; id: string };

type CardFontSizes = { basePx: number; rubyPx: number };

/** Renders `[[kanji|reading]]` wiki markup as HTML ruby (same convention as Retentio mobile). */
function WikiRubyInline({
  text,
  fontSizes,
}: {
  text: string;
  fontSizes?: CardFontSizes;
}): ReactNode {
  const basePx = fontSizes?.basePx;
  const rubyPx = fontSizes?.rubyPx;
  const baseClass = "font-semibold tracking-wide";
  const baseStyle = basePx != null ? ({ fontSize: basePx } as const) : undefined;
  /** Space between furigana (rt) and base line. */
  const rtStyle =
    rubyPx != null
      ? ({ fontSize: rubyPx, paddingBottom: "4mm" } as const)
      : ({ paddingBottom: "4mm" } as const);

  if (!looksLikeWikiRubyMarkup(text)) {
    if (basePx != null) {
      return (
        <span style={baseStyle} className={baseClass}>
          {text}
        </span>
      );
    }
    return text;
  }

  return (
    <>
      {parseWikiRubyMarkup(text).map((seg, i) =>
        seg.type === "plain" ? (
          basePx != null ? (
            <span key={i} style={baseStyle} className={baseClass}>
              {seg.text}
            </span>
          ) : (
            <Fragment key={i}>{seg.text}</Fragment>
          )
        ) : (
          <ruby key={i} className={`[ruby-align:center] ${baseClass}`} style={baseStyle}>
            {seg.main}
            <rt
              className={
                rubyPx != null
                  ? "font-normal text-muted-foreground tracking-tight"
                  : "text-[0.65em] font-normal text-muted-foreground tracking-tight"
              }
              style={rtStyle}
            >
              {seg.reading}
            </rt>
          </ruby>
        )
      )}
    </>
  );
}

function parseFieldWithMedia(text: string): FieldSegment[] {
  const normalized = normalizeMediaMarkers(text);
  const segments: FieldSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  MEDIA_MARKER_RE.lastIndex = 0;
  while ((m = MEDIA_MARKER_RE.exec(normalized)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ kind: "text", value: normalized.slice(lastIndex, m.index) });
    }
    const type = m[1] as "image" | "audio" | "video" | "json";
    const id = m[2];
    if (type === "image") segments.push({ kind: "image", id });
    else if (type === "audio") segments.push({ kind: "audio", id });
    else if (type === "video") segments.push({ kind: "video", id });
    else segments.push({ kind: "json", id });
    lastIndex = MEDIA_MARKER_RE.lastIndex;
  }
  if (lastIndex < normalized.length) {
    segments.push({ kind: "text", value: normalized.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ kind: "text", value: normalized }];
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
          if (!canPlay) {
            return;
          }
          void el.play().catch(() => {});
        }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-input bg-muted/50 hover:bg-muted text-foreground"
        aria-label="Play audio"
      >
        <span className="text-sm" aria-hidden>▶</span>
      </button>
    </>
  );
}

function JsonAttachmentPlaceholder() {
  return (
    <span className="text-muted-foreground text-sm" aria-label="JSON attachment">
      JSON
    </span>
  );
}

function MediaBlock({
  kind,
  id,
  token,
}: {
  kind: "image" | "audio" | "video";
  id: string;
  token: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  /** Fetched bytes for audio only — played via `audio.srcObject` (avoids `blob:` URL decode issues). */
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState(false);
  /** Last fetch error message from API (e.g. 401/403 JSON `msg`). */
  const [loadErrMsg, setLoadErrMsg] = useState("");
  const baseUrl = getApiBaseUrl();

  useEffect(() => {
    const fetchUrl = resolveMediaFetchUrl(id, baseUrl);
    let objectUrl: string | null = null;
    let stale = false;
    setBlobUrl(null);
    setAudioBlob(null);
    setError(false);
    setLoadErrMsg("");

    void (async () => {
      try {
        const { blob } = await fetchMediaCached(fetchUrl, token, kind);
        if (stale) return;
        if (kind === "audio") {
          setAudioBlob(blob);
        } else {
          const url = URL.createObjectURL(blob);
          objectUrl = url;
          setBlobUrl(url);
        }
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
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
  }, [id, token, baseUrl, kind]);

  if (error) {
    const hint = loadErrMsg.trim() || "media unavailable";
    return (
      <span className="text-muted-foreground text-sm" title={loadErrMsg}>
        [{hint}]
      </span>
    );
  }
  if (kind === "audio") {
    if (!audioBlob) return <span className="text-muted-foreground text-sm">…</span>;
    return <AudioPlayButton mediaBlob={audioBlob} />;
  }
  if (!blobUrl) return <span className="text-muted-foreground text-sm">…</span>;
  if (kind === "image") {
    return <img src={blobUrl} alt="" className="max-h-32 max-w-full rounded object-contain" />;
  }
  if (kind === "video") {
    return (
      <video src={blobUrl} controls className="max-h-32 max-w-full rounded" preload="metadata">
        Your browser does not support video.
      </video>
    );
  }
  return null;
}

export function FieldWithMedia({
  text,
  token,
  fontSizes,
  imageRevealed = false,
  onRevealImage,
  hideImages = false,
  textOnly = false,
  mediaOnly = false,
}: {
  text: string;
  token: string | null;
  /** When set, main line and ruby use these pixel sizes (per card side). */
  fontSizes?: CardFontSizes;
  imageRevealed?: boolean;
  onRevealImage?: () => void;
  hideImages?: boolean;
  textOnly?: boolean;
  mediaOnly?: boolean;
}) {
  if (textOnly) {
    const display = formatMediaMarkersForDisplay(text);
    return (
      <span className="block max-h-[18rem] overflow-y-auto overflow-x-auto break-words whitespace-pre-wrap">
        <WikiRubyInline text={display} fontSizes={fontSizes} />
      </span>
    );
  }
  const segments = useMemo(() => parseFieldWithMedia(text), [text]);
  const hasMedia = segments.some((s) => s.kind !== "text");
  if (!token || !hasMedia) {
    return (
      <>
        {mediaOnly ? null : text ? <WikiRubyInline text={text} fontSizes={fontSizes} /> : " "}
      </>
    );
  }
  const imageSegments = segments.filter((s): s is Extract<FieldSegment, { kind: "image" }> => s.kind === "image");
  const otherSegments = segments.filter((s) => s.kind !== "image");
  const hasImage = imageSegments.length > 0 && !hideImages;

  const textAndAudio = (
    <span className="inline-flex max-w-full min-w-0 flex-row flex-nowrap items-center gap-2">
      {otherSegments.map((seg, i) =>
        seg.kind === "text" ? (
          mediaOnly ? null : (
            <span
              key={i}
              className="min-w-0 break-words whitespace-pre-wrap max-h-[18rem] overflow-y-auto overflow-x-auto"
            >
              <WikiRubyInline text={seg.value} fontSizes={fontSizes} />
            </span>
          )
        ) : seg.kind === "json" ? (
          <JsonAttachmentPlaceholder key={`json-${seg.id}-${i}`} />
        ) : (
          <span key={`${seg.kind}-${seg.id}-${i}`} className="shrink-0">
            <MediaBlock kind={seg.kind} id={seg.id} token={token} />
          </span>
        )
      )}
    </span>
  );

  const showImageHint = hasImage && onRevealImage != null && !imageRevealed;
  const showImages = hasImage && (imageRevealed || onRevealImage == null);

  const images = showImages
    ? imageSegments.map((seg, i) => (
        <MediaBlock key={`image-${seg.id}-${i}`} kind="image" id={seg.id} token={token} />
      ))
    : null;

  if (mediaOnly) {
    return (
      <span className="inline-flex flex-wrap items-center justify-center gap-3">
        {textAndAudio}
        {showImageHint && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRevealImage?.();
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Show image
          </button>
        )}
        {images}
      </span>
    );
  }
  if (hasImage) {
    return (
      <span className="inline-flex flex-wrap items-center justify-center gap-3">
        <span className="min-w-0">{textAndAudio}</span>
        {showImageHint && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRevealImage?.();
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Show image
          </button>
        )}
        {images}
      </span>
    );
  }
  return <>{textAndAudio}</>;
}

/** Accent bar + uppercase field name (matches Flutter `_FieldSectionLabel` on multi-field backs). */
function FieldSectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5" role="heading" aria-label={label}>
      <span className="h-3 w-0.5 shrink-0 rounded-sm bg-primary" aria-hidden />
      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
        {label.toUpperCase()}
      </span>
    </div>
  );
}

function entryFieldLabel(entry: CardEntry, index: number): string {
  const name = entry.field?.trim();
  return name && name.length > 0 ? name : `Field ${index + 1}`;
}

interface CardSectionProps {
  deck: DeckItem | null;
  /** Main and ruby font sizes for front vs back; defaults match the Retentio app. */
  cardTypography?: DeckCardSidesTypography;
  nextCard: GetNextCardRes["data"] | null;
  nextCardFact: FactItem | null;
  loadingNextCard: boolean;
  cardError: string;
  cardSuccess: string;
  /** Study-scope card stats (all tags or a fact tag): total, due/overdue, reviewed. */
  tagFilterStats?: { cardsCount: number; dueCards: number; reviewedCards: number } | null;
  /** True while tag-scoped stats are fetching (do not show All-tags numbers). */
  tagFilterStatsLoading?: boolean;
  onUpdateCard: (intervalSeconds: number) => void;
  onHideCard: (cardId: string) => void;
  onSaveFact?: (factId: string, entries: Entry[]) => Promise<void>;
  /** Import decks: open report form for the current card's fact. */
  onReportFact?: (factId: string) => void | Promise<void>;
  /**
   * Import decks: after a successful Edit save, show an opt-in to send the
   * private overlay to the author (fact_edit contribution).
   */
  onOfferSendEditToAuthor?: (factId: string) => void | Promise<void>;
  /** When next card has precomputed front/back, fact is not loaded. Pass this to fetch fact by id when opening Duplicate or Edit. */
  onRequestFact?: (factId: string) => Promise<FactItem | null>;
  authToken?: string | null;
  rescheduleSuggested?: boolean;
  suggestedRescheduleDays?: number;
  onReschedule?: (days: number) => void;
  onAddCardSuccess?: () => void;
  onDeleteCard?: (cardId: string) => Promise<void>;
}

export function CardSection({
  deck,
  cardTypography = DECK_CARD_TYPOGRAPHY_DEFAULTS,
  nextCard,
  nextCardFact,
  loadingNextCard,
  cardError,
  cardSuccess,
  tagFilterStats = null,
  tagFilterStatsLoading = false,
  onUpdateCard,
  onHideCard,
  onSaveFact,
  onReportFact,
  onOfferSendEditToAuthor,
  onRequestFact,
  authToken,
  rescheduleSuggested,
  suggestedRescheduleDays,
  onReschedule,
  onAddCardSuccess,
  onDeleteCard,
}: CardSectionProps) {
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);
  const [duplicateFact, setDuplicateFact] = useState<FactItem | null>(null);
  const [deleteConfirmCardId, setDeleteConfirmCardId] = useState<string | null>(null);
  /** Absolute selected interval in seconds (Flutter `selectedInterval`; default = mid/def). */
  const [selectedIntervalSec, setSelectedIntervalSec] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hasFlippedOnce, setHasFlippedOnce] = useState(false);
  const [editPopupOpen, setEditPopupOpen] = useState(false);
  const [editFactId, setEditFactId] = useState<string | null>(null);
  const [editFactEntries, setEditFactEntries] = useState<Entry[]>([]);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  /** Active front field tab (Flutter always uses field tabs on the front). */
  const [frontFieldTab, setFrontFieldTab] = useState(0);
  /** Fact id with a pending “send edit to author?” notice (import decks). */
  const [pendingContributeFactId, setPendingContributeFactId] = useState<string | null>(null);

  const cardResetKey = nextCard ? `${nextCard.card.id}-${nextCard.card.due_date}` : null;

  const intervalRange = useMemo(() => {
    if (!nextCard) {
      return reviewIntervalRangeFromTimestamps({
        nowSec: 0,
        lastReview: 0,
        dueDate: 0,
      });
    }
    return reviewIntervalRangeFromTimestamps({
      nowSec: nowUnixSecondsUtc(),
      lastReview: nextCard.card.last_review,
      dueDate: nextCard.card.due_date,
    });
  }, [cardResetKey, nextCard]);

  useEffect(() => {
    if (nextCard) {
      setSelectedIntervalSec(intervalRange.midInterval);
    }
  }, [cardResetKey, intervalRange.midInterval, nextCard]);

  useEffect(() => {
    if (nextCard) {
      setFlipped(false);
      setHasFlippedOnce(false);
      setFrontFieldTab(0);
      setPendingContributeFactId(null);
    }
  }, [cardResetKey]);

  const handleFlip = () => {
    setFlipped((f) => !f);
    setHasFlippedOnce(true);
  };

  const intervalSec =
    intervalRange.maxInterval > intervalRange.minInterval
      ? Math.min(
          intervalRange.maxInterval,
          Math.max(intervalRange.minInterval, selectedIntervalSec)
        )
      : selectedIntervalSec;

  const handleSubmit = () => {
    onUpdateCard(Math.round(intervalSec));
  };

  const openDuplicateModal = async () => {
    if (!nextCard || !onAddCardSuccess) return;
    if (nextCardFact) {
      setDuplicateFact(nextCardFact);
      setAddCardModalOpen(true);
      return;
    }
    if (onRequestFact) {
      const fact = await onRequestFact(nextCard.card.fact_id);
      if (fact) {
        setDuplicateFact(fact);
        setAddCardModalOpen(true);
      }
    }
  };

  const openEditPopup = async () => {
    if (!nextCard) return;
    if (nextCardFact) {
      setEditFactId(nextCardFact.id);
      setEditFactEntries(nextCardFact.entries.map((e) => ({ ...e })));
      setEditError("");
      setEditPopupOpen(true);
      return;
    }
    if (onRequestFact) {
      const fact = await onRequestFact(nextCard.card.fact_id);
      if (fact) {
        setEditFactId(fact.id);
        setEditFactEntries(fact.entries.map((e) => ({ ...e })));
        setEditError("");
        setEditPopupOpen(true);
      }
    }
  };

  const hasContent = (e: Entry) =>
    (e.text?.trim() ?? "") !== "" || !!e.audio || !!e.image || !!e.video || !!e.json;

  const fontFront: CardFontSizes = {
    basePx: cardTypography.front.baseFontSize,
    rubyPx: cardTypography.front.rubyFontSize,
  };
  const fontBack: CardFontSizes = {
    basePx: cardTypography.back.baseFontSize,
    rubyPx: cardTypography.back.rubyFontSize,
  };

  const resolveCurrentFactId = async (): Promise<string | null> => {
    if (!nextCard) return null;
    if (nextCardFact) return nextCardFact.id;
    if (onRequestFact) {
      const fact = await onRequestFact(nextCard.card.fact_id);
      return fact?.id ?? null;
    }
    return nextCard.card.fact_id ?? null;
  };

  const openReportFeedback = async () => {
    if (!onReportFact) return;
    const factId = await resolveCurrentFactId();
    if (factId) await onReportFact(factId);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveFact || !editFactId || !deck) return;
    if (editFactEntries.length === 0 || !editFactEntries.every(hasContent)) {
      setEditError("Each entry must have at least one of text, audio, image, video, or JSON.");
      return;
    }
    setEditError("");
    setEditSaving(true);
    try {
      await onSaveFact(editFactId, editFactEntries);
      setEditPopupOpen(false);
      if (onOfferSendEditToAuthor) {
        setPendingContributeFactId(editFactId);
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  const reviewedProgress =
    tagFilterStats != null && tagFilterStats.cardsCount > 0
      ? {
          reviewed: Math.min(tagFilterStats.reviewedCards, tagFilterStats.cardsCount),
          total: tagFilterStats.cardsCount,
          percent: Math.round(
            (Math.min(tagFilterStats.reviewedCards, tagFilterStats.cardsCount) /
              tagFilterStats.cardsCount) *
              100
          ),
        }
      : null;

  return (
    <Card>
      <CardHeader className="text-center space-y-2">
        <CardTitle>Cards</CardTitle>
        {tagFilterStatsLoading && (
          <p className="text-sm text-muted-foreground font-normal">Loading tag stats…</p>
        )}
        {tagFilterStats != null && (
          <div className="space-y-1.5 px-1">
            <p className="text-sm text-muted-foreground font-normal">
              Total {tagFilterStats.cardsCount} · Overdue {tagFilterStats.dueCards}
            </p>
            {deck != null && (
              <p className="text-sm text-muted-foreground font-normal">
                Reviews today {deck.stats.total_reviews_today} · Total reviews{" "}
                {deck.stats.total_reviews}
              </p>
            )}
            {reviewedProgress != null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {reviewedProgress.reviewed} / {reviewedProgress.total} reviewed
                  </span>
                  <span>{reviewedProgress.percent}%</span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={reviewedProgress.reviewed}
                  aria-valuemin={0}
                  aria-valuemax={reviewedProgress.total}
                  aria-label="Reviewed cards progress"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${reviewedProgress.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {cardError && <p className="text-sm text-destructive">{cardError}</p>}
        {cardSuccess && <p className="text-sm text-green-600">{cardSuccess}</p>}
        {rescheduleSuggested && suggestedRescheduleDays != null && suggestedRescheduleDays > 0 && onReschedule && (
          <p className="text-sm text-muted-foreground">
            Been away?{" "}
            <button
              type="button"
              onClick={() => onReschedule(suggestedRescheduleDays)}
              className="text-primary hover:underline font-medium"
            >
              Shift schedule by {suggestedRescheduleDays} days
            </button>
          </p>
        )}
        {!nextCard && loadingNextCard ? (
          <p className="text-muted-foreground">Loading next card…</p>
        ) : null}
        {nextCard && deck && (nextCardFact || (Array.isArray(nextCard.card.front) && Array.isArray(nextCard.card.back))) && (
          <div className="relative rounded-lg border p-4 space-y-3">
            {loadingNextCard && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/80"
                aria-busy="true"
              >
                <p className="text-sm text-muted-foreground">Loading next card…</p>
              </div>
            )}
            <div className="absolute top-2 right-2">
              <DropdownMenu align="end">
                {nextCard && onSaveFact && (nextCardFact || onRequestFact) && (
                  <DropdownMenuItem
                    onClick={openEditPopup}
                    disabled={loadingNextCard}
                  >
                    Edit
                  </DropdownMenuItem>
                )}
                {nextCard && onReportFact && (nextCardFact || onRequestFact) && (
                  <DropdownMenuItem
                    onClick={() => void openReportFeedback()}
                    disabled={loadingNextCard}
                  >
                    Report to author
                  </DropdownMenuItem>
                )}
                {nextCard && onAddCardSuccess && (nextCardFact || onRequestFact) && (
                  <DropdownMenuItem
                    onClick={openDuplicateModal}
                    disabled={loadingNextCard}
                  >
                    Duplicate
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onHideCard(nextCard.card.id)} disabled={loadingNextCard}>
                  Hide card
                </DropdownMenuItem>
                {onDeleteCard && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteConfirmCardId(nextCard.card.id)}
                    disabled={loadingNextCard}
                  >
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenu>
            </div>
            {pendingContributeFactId && onOfferSendEditToAuthor && (
              <div
                role="status"
                className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-left text-sm space-y-2"
              >
                <p>
                  Saved privately on this import. Send this edit to the author?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const factId = pendingContributeFactId;
                      setPendingContributeFactId(null);
                      void onOfferSendEditToAuthor(factId);
                    }}
                  >
                    Send to author
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingContributeFactId(null)}
                  >
                    Not now
                  </Button>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Due: {formatUnixSecondsUtc(nextCard.card.due_date)}
            </p>
            {(() => {
              const frontEntries = Array.isArray(nextCard.card.front) ? nextCard.card.front : null;
              const backEntries = Array.isArray(nextCard.card.back) ? nextCard.card.back : null;
              const useEntries = frontEntries && backEntries;

              const renderItemContent = (item: CardEntryItem, isFront: boolean): ReactNode => {
                const fontSizes = isFront ? fontFront : fontBack;
                switch (item.type) {
                  case "text":
                    return (
                      <FieldWithMedia text={item.value} token={authToken ?? null} fontSizes={fontSizes} />
                    );
                  case "audio":
                    return authToken ? (
                      <MediaBlock kind="audio" id={item.value} token={authToken} />
                    ) : null;
                  case "image":
                    return authToken ? (
                      <MediaBlock kind="image" id={item.value} token={authToken} />
                    ) : null;
                  case "video":
                    return authToken ? (
                      <MediaBlock kind="video" id={item.value} token={authToken} />
                    ) : null;
                  case "json":
                    // Flutter study UI skips json items.
                    return null;
                  default:
                    return (
                      <span className="text-muted-foreground" style={{ fontSize: fontSizes.basePx }}>
                        {item.value || "—"}
                      </span>
                    );
                }
              };

              /** One field = one row: text with audio play button beside it; image/video may wrap. */
              const renderEntryItems = (
                entry: CardEntry,
                isFront: boolean,
                align: "center" | "start",
                keyBase: number
              ) => {
                const items = cardEntryToRenderItems(entry);
                const textAudio = items.filter((it) => it.type === "text" || it.type === "audio");
                const other = items.filter((it) => it.type !== "text" && it.type !== "audio");
                const rowClass =
                  align === "start"
                    ? "inline-flex w-full min-w-0 flex-row flex-nowrap items-center gap-2 text-left"
                    : "inline-flex max-w-full min-w-0 flex-row flex-nowrap items-center justify-center gap-2";
                const textAudioNodes = textAudio
                  .map((item, i) => {
                    const content = renderItemContent(item, isFront);
                    if (content == null) return null;
                    return (
                      <span
                        key={`${keyBase}-ta-${i}`}
                        className={
                          item.type === "text" ? "min-w-0 break-words" : "shrink-0"
                        }
                      >
                        {content}
                      </span>
                    );
                  })
                  .filter(Boolean);
                const otherNodes = other
                  .map((item, i) => {
                    const content = renderItemContent(item, isFront);
                    if (content == null) return null;
                    return (
                      <span key={`${keyBase}-o-${i}`} className="shrink-0">
                        {content}
                      </span>
                    );
                  })
                  .filter(Boolean);
                if (textAudioNodes.length === 0 && otherNodes.length === 0) return null;
                return (
                  <span
                    key={keyBase}
                    className={
                      otherNodes.length > 0
                        ? align === "start"
                          ? "inline-flex w-full flex-col items-stretch gap-2 text-left"
                          : "inline-flex flex-col items-center gap-2"
                        : undefined
                    }
                  >
                    {textAudioNodes.length > 0 ? (
                      <span className={rowClass}>{textAudioNodes}</span>
                    ) : null}
                    {otherNodes}
                  </span>
                );
              };

              /** Front: field tabs (Flutter CardContentContainer tabbed). Back: stacked sections when multi-field. */
              const renderFlipFaces = (front: CardEntry[], back: CardEntry[]) => {
                const safeFrontTab =
                  front.length === 0 ? 0 : Math.min(frontFieldTab, front.length - 1);
                const activeFront = front[safeFrontTab] ?? front[0];
                const multiBack = back.length > 1;

                return (
                  <div
                    className="perspective-[1000px] cursor-pointer select-none min-h-[10rem]"
                    onClick={handleFlip}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleFlip();
                      }
                    }}
                    aria-label={flipped ? "Flip to front" : "Flip to back"}
                  >
                    <div
                      className="relative min-h-[10rem] w-full transition-transform duration-[240ms] [transform-style:preserve-3d]"
                      style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                    >
                      <div
                        className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl border bg-card font-card [backface-visibility:hidden]"
                        style={{ transform: "rotateY(0deg)" }}
                      >
                        {front.length > 0 && (
                          <div
                            className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/40 px-1"
                            role="tablist"
                            aria-label="Front fields"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {front.map((entry, i) => {
                              const selected = i === safeFrontTab;
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  role="tab"
                                  aria-selected={selected}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFrontFieldTab(i);
                                  }}
                                  className={
                                    selected
                                      ? "shrink-0 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-primary"
                                      : "shrink-0 rounded-xl px-2.5 py-1.5 text-sm font-medium text-foreground/40"
                                  }
                                >
                                  {entryFieldLabel(entry, i)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-3 overflow-x-auto overflow-y-auto p-4 text-center max-h-[18rem]">
                          {activeFront ? (
                            renderEntryItems(activeFront, true, "center", 0)
                          ) : (
                            <span className="text-muted-foreground" style={{ fontSize: fontFront.basePx }}>
                              —
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className="absolute inset-0 overflow-y-auto rounded-2xl border bg-muted/50 font-card [backface-visibility:hidden]"
                        style={{ transform: "rotateY(180deg)" }}
                      >
                        {back.length === 0 ? (
                          <div className="flex h-full min-h-[10rem] items-center justify-center p-4 text-center">
                            <p className="text-muted-foreground" style={{ fontSize: fontBack.basePx }}>
                              —
                            </p>
                          </div>
                        ) : multiBack ? (
                          <div className="flex flex-col gap-3.5 px-3.5 pb-4 pt-3 text-left">
                            {back.map((entry, entryIdx) => (
                              <div key={entryIdx}>
                                {entryIdx > 0 && (
                                  <div className="mb-3.5 border-t border-border/35" aria-hidden />
                                )}
                                <FieldSectionLabel label={entryFieldLabel(entry, entryIdx)} />
                                <div className="mt-1.5 flex flex-col items-stretch gap-2">
                                  {renderEntryItems(entry, false, "start", entryIdx * 1000)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex min-h-[10rem] flex-wrap items-center justify-center gap-3 overflow-x-auto overflow-y-auto p-4 text-center max-h-[18rem]">
                            {renderEntryItems(back[0], false, "center", 0)}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Click to flip</p>
                  </div>
                );
              };

              if (useEntries) {
                return renderFlipFaces(frontEntries, backEntries);
              }

              const factEntries = nextCardFact?.entries ?? [];
              const t = nextCard.card.template;
              const frontIndices = Array.isArray(t?.[0]) ? t[0] : [0];
              const backIndices = Array.isArray(t?.[1]) ? t[1] : [];
              const deckFields = deck?.fields ?? [];
              const toCardEntry = (index: number): CardEntry => {
                const entry = factEntries[index];
                const field = deckFields[index];
                if (!entry || typeof entry !== "object") {
                  return { field, text: typeof entry === "string" ? entry : "" };
                }
                return {
                  field,
                  text: entry.text,
                  audio: entry.audio,
                  image: entry.image,
                  video: entry.video,
                  json: entry.json,
                };
              };
              return renderFlipFaces(
                frontIndices.map(toCardEntry),
                backIndices.map(toCardEntry)
              );
            })()}
            {hasFlippedOnce && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Hard</span>
                  <span>{formatReviewIntervalLabel(intervalSec)}</span>
                  <span>Easy</span>
                </div>
                <input
                  type="range"
                  min={intervalRange.minInterval}
                  max={Math.max(intervalRange.maxInterval, intervalRange.minInterval)}
                  step={
                    intervalRange.maxInterval > intervalRange.minInterval
                      ? (intervalRange.maxInterval - intervalRange.minInterval) / 100
                      : 1
                  }
                  value={intervalSec}
                  disabled={intervalRange.maxInterval <= 0}
                  onChange={(e) => setSelectedIntervalSec(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                />
                <div className="flex justify-center">
                  <Button
                    type="button"
                    className="h-8 px-3 text-xs"
                    onClick={handleSubmit}
                    disabled={loadingNextCard || intervalRange.maxInterval <= 0}
                  >
                    {loadingNextCard ? "Loading…" : "Review"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {editPopupOpen && deck && editFactId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/50" onClick={() => setEditPopupOpen(false)} aria-hidden="true" />
          <div className="relative z-50 w-full max-w-md rounded-lg border bg-card p-6 shadow-lg flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Edit fact</h2>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <div className="space-y-3">
                {editFactEntries.map((entry, i) => (
                  <div key={i} className="space-y-1">
                    <Label htmlFor={`card-edit-field-${i}`}>
                      {i < (deck.fields?.length ?? 0) ? deck.fields![i] : `field ${i + 1}`}
                    </Label>
                    <textarea
                      id={`card-edit-field-${i}`}
                      value={entry.text ?? ""}
                      onChange={(e) => {
                        const next = editFactEntries.map((ent, j) =>
                          j === i ? { ...ent, text: e.target.value } : ent
                        );
                        setEditFactEntries(next);
                      }}
                      disabled={editSaving}
                      rows={4}
                      className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditPopupOpen(false)} disabled={editSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {addCardModalOpen &&
        deck &&
        duplicateFact &&
        authToken &&
        onAddCardSuccess && (
          <AddCardFromFactModal
            open={addCardModalOpen}
            onOpenChange={(open) => {
              setAddCardModalOpen(open);
              if (!open) setDuplicateFact(null);
            }}
            deck={deck}
            fact={duplicateFact}
            token={authToken}
            onSuccess={onAddCardSuccess}
          />
        )}
      <Dialog
        open={deleteConfirmCardId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmCardId(null);
        }}
        title="Delete card?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => {
          if (deleteConfirmCardId && onDeleteCard) onDeleteCard(deleteConfirmCardId);
        }}
      >
        This will remove the card from the deck. The fact is kept.
      </Dialog>
    </Card>
  );
}
