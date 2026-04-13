import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { DeckItem, Entry, FactItem } from "@/lib/api";
import { cardEntryToRenderItems, type CardEntryItem, type GetCardsRes, type GetNextCardRes } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/api";
import { AddCardFromFactModal } from "./AddCardFromFactModal";
import { formatMediaMarkersForDisplay } from "@/lib/utils";

function getMinMaxIntervalSeconds(card: GetNextCardRes["data"]["card"]): {
  minIntervalSec: number;
  maxIntervalSec: number;
} {
  const lastReview = card.last_review;
  const dueDate = card.due_date;
  const currentIntervalSec = Math.max(
    60,
    lastReview === 0 ? 60 : Math.max(60, dueDate - lastReview)
  );
  const nowSec = Math.floor(Date.now() / 1000);
  const denom = Math.max(60, dueDate - lastReview);
  const urgency = (nowSec - lastReview) / denom;

  let minIntervalSec: number;
  let maxIntervalSec: number;
  if (urgency >= 1) {
    minIntervalSec = currentIntervalSec * 0.5;
    maxIntervalSec = currentIntervalSec * 4.0;
  } else {
    minIntervalSec = currentIntervalSec * ((0.5 - 1) * urgency + 1);
    maxIntervalSec = currentIntervalSec * ((4.0 - 1) * urgency + 1);
  }
  minIntervalSec = Math.max(60, minIntervalSec);
  maxIntervalSec = Math.max(minIntervalSec, maxIntervalSec);
  return { minIntervalSec, maxIntervalSec };
}

function formatInterval(seconds: number): string {
  const sec = Math.round(seconds);
  if (sec >= 86400) return `${(sec / 86400).toFixed(1)}d`;
  if (sec >= 3600) return `${(sec / 3600).toFixed(1)}h`;
  if (sec >= 60) return `${Math.round(sec / 60)}m`;
  return `${sec}s`;
}

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

function AudioPlayButton({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  return (
    <>
      <audio ref={audioRef} src={src} className="hidden" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          audioRef.current?.play();
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
  const [error, setError] = useState(false);
  const baseUrl = getApiBaseUrl();

  useEffect(() => {
    const fetchUrl =
      id.startsWith("http://") || id.startsWith("https://") ? id : `${baseUrl}/api/media/${id}`;
    let revoked = false;
    let createdUrl: string | null = null;
    setBlobUrl(null);
    setError(false);

    fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error("Failed to load"))))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (!revoked) {
          createdUrl = url;
          setBlobUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (!revoked) setError(true);
      });
    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [id, token, baseUrl]);

  if (error) return <span className="text-muted-foreground text-sm">[media unavailable]</span>;
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
  return (
    <AudioPlayButton src={blobUrl} />
  );
}

export function FieldWithMedia({
  text,
  token,
  imageRevealed = false,
  onRevealImage,
  hideImages = false,
  textOnly = false,
  mediaOnly = false,
}: {
  text: string;
  token: string | null;
  imageRevealed?: boolean;
  onRevealImage?: () => void;
  hideImages?: boolean;
  textOnly?: boolean;
  mediaOnly?: boolean;
}) {
  if (textOnly) {
    return (
      <span className="block max-h-[18rem] overflow-y-auto overflow-x-auto break-words whitespace-pre-wrap">
        {formatMediaMarkersForDisplay(text)}
      </span>
    );
  }
  const segments = useMemo(() => parseFieldWithMedia(text), [text]);
  const hasMedia = segments.some((s) => s.kind !== "text");
  if (!token || !hasMedia) {
    return <>{mediaOnly ? null : (text || " ")}</>;
  }
  const imageSegments = segments.filter((s): s is Extract<FieldSegment, { kind: "image" }> => s.kind === "image");
  const otherSegments = segments.filter((s) => s.kind !== "image");
  const hasImage = imageSegments.length > 0 && !hideImages;

  const textAndAudio = (
    <>
      {otherSegments.map((seg, i) =>
        seg.kind === "text" ? (
          mediaOnly ? null : (
            <span
              key={i}
              className="break-words whitespace-pre-wrap max-h-[18rem] overflow-y-auto overflow-x-auto"
            >
              {seg.value}
            </span>
          )
        ) : seg.kind === "json" ? (
          <JsonAttachmentPlaceholder key={`json-${seg.id}-${i}`} />
        ) : (
          <MediaBlock key={`${seg.kind}-${seg.id}-${i}`} kind={seg.kind} id={seg.id} token={token} />
        )
      )}
    </>
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

interface CardSectionProps {
  deck: DeckItem | null;
  cardStats: GetCardsRes["data"] | null;
  loadingCards: boolean;
  nextCard: GetNextCardRes["data"] | null;
  nextCardFact: FactItem | null;
  loadingNextCard: boolean;
  cardError: string;
  cardSuccess: string;
  onUpdateCard: (intervalSeconds: number) => void;
  onHideCard: (cardId: string) => void;
  onSaveFact?: (factId: string, entries: Entry[]) => Promise<void>;
  /** When next card has precomputed front/back, fact is not loaded. Pass this to fetch fact by id when opening Duplicate or Edit. */
  onRequestFact?: (factId: string) => Promise<FactItem | null>;
  authToken?: string | null;
  rescheduleSuggested?: boolean;
  suggestedRescheduleDays?: number;
  onReschedule?: (days: number) => void;
  onAddCardSuccess?: () => void;
  onDeleteCard?: (cardId: string) => Promise<void>;
}

const SLIDER_DEFAULT = 0.5;

export function CardSection({
  deck,
  cardStats,
  loadingCards: _loadingCards,
  nextCard,
  nextCardFact,
  loadingNextCard,
  cardError,
  cardSuccess,
  onUpdateCard,
  onHideCard,
  onSaveFact,
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
  const [sliderValue, setSliderValue] = useState(SLIDER_DEFAULT);
  const [flipped, setFlipped] = useState(false);
  const [hasFlippedOnce, setHasFlippedOnce] = useState(false);
  const [editPopupOpen, setEditPopupOpen] = useState(false);
  const [editFactId, setEditFactId] = useState<string | null>(null);
  const [editFactEntries, setEditFactEntries] = useState<Entry[]>([]);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [imageRevealed, setImageRevealed] = useState(false);
  const [examplesRevealed, setExamplesRevealed] = useState(false);

  const cardResetKey = nextCard ? `${nextCard.card.id}-${nextCard.card.due_date}` : null;

  useEffect(() => {
    if (nextCard) setSliderValue(SLIDER_DEFAULT);
  }, [cardResetKey]);

  useEffect(() => {
    if (nextCard) {
      setFlipped(false);
      setHasFlippedOnce(false);
      setImageRevealed(false);
      setExamplesRevealed(false);
    }
  }, [cardResetKey]);

  const handleFlip = () => {
    setFlipped((f) => !f);
    setHasFlippedOnce(true);
  };

  const { intervalSec } = useMemo(() => {
    if (!nextCard) return { minIntervalSec: 60, maxIntervalSec: 86400, intervalSec: 43200 };
    const { minIntervalSec: min, maxIntervalSec: max } = getMinMaxIntervalSeconds(nextCard.card);
    const interval = min + (max - min) * sliderValue;
    return { minIntervalSec: min, maxIntervalSec: max, intervalSec: interval };
  }, [nextCard, sliderValue]);

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
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Cards</CardTitle>
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
        ) : cardStats !== null ? (
          <p className="text-sm text-muted-foreground">
            Total: {cardStats.total_cards} · Hidden: {cardStats.hidden_count}
            {cardStats.orphaned_hidden_cards != null &&
              cardStats.orphaned_hidden_cards > 0 &&
              ` · Orphaned: ${cardStats.orphaned_hidden_cards}`}
          </p>
        ) : null}
        {nextCard && deck && (nextCardFact || (Array.isArray(nextCard.card.front) && Array.isArray(nextCard.card.back))) && (
          <div className="relative rounded-lg border p-4 space-y-3">
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
            <p className="text-xs text-muted-foreground">
              Due: {new Date(nextCard.card.due_date * 1000).toLocaleString()}
            </p>
            {(() => {
              const frontEntries = Array.isArray(nextCard.card.front) ? nextCard.card.front : null;
              const backEntries = Array.isArray(nextCard.card.back) ? nextCard.card.back : null;
              const useEntries = frontEntries && backEntries;

              const renderItem = (item: CardEntryItem, key: number) => {
                let content: ReactNode = null;
                switch (item.type) {
                  case "text":
                    content = <FieldWithMedia text={item.value} token={authToken ?? null} />;
                    break;
                  case "audio":
                    if (authToken) content = <MediaBlock kind="audio" id={item.value} token={authToken} />;
                    break;
                  case "image":
                    if (authToken) content = <MediaBlock kind="image" id={item.value} token={authToken} />;
                    break;
                  case "video":
                    if (authToken) content = <MediaBlock kind="video" id={item.value} token={authToken} />;
                    break;
                  case "json":
                    content = <JsonAttachmentPlaceholder />;
                    break;
                  default:
                    content = <span className="text-muted-foreground">{item.value || "—"}</span>;
                }
                return (
                  <span key={key} className="inline-flex flex-col items-center gap-0.5">
                    {content ?? "—"}
                  </span>
                );
              };

              if (useEntries) {
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
                      className="relative min-h-[10rem] w-full transition-transform duration-300 [transform-style:preserve-3d]"
                      style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                    >
                      <div
                        className="absolute inset-0 flex flex-wrap items-center justify-center gap-3 rounded-lg border bg-card p-4 text-center text-lg [backface-visibility:hidden] overflow-x-auto overflow-y-auto max-h-[18rem]"
                        style={{ transform: "rotateY(0deg)" }}
                      >
                        {frontEntries.map((entry, entryIdx) => (
                          <div key={entryIdx} className="flex flex-wrap items-center justify-center gap-3">
                            {cardEntryToRenderItems(entry).map((item, i) =>
                              renderItem(item, entryIdx * 1000 + i)
                            )}
                          </div>
                        ))}
                      </div>
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-lg border bg-muted/50 p-4 text-center [backface-visibility:hidden]"
                        style={{ transform: "rotateY(180deg)" }}
                      >
                        {backEntries.length > 0 ? (
                          <>
                            <div className="flex flex-wrap items-center justify-center gap-3 text-lg overflow-x-auto overflow-y-auto max-h-[18rem]">
                              {cardEntryToRenderItems(backEntries[0]).map((item, i) => renderItem(item, i))}
                            </div>
                            {backEntries.length > 1 && (
                              examplesRevealed ? (
                                <div className="mt-3 space-y-2 text-left">
                                  {backEntries.slice(1).map((entry, entryIdx) => (
                                    <p key={entryIdx} className="text-base">
                                      {cardEntryToRenderItems(entry).map((item, i) =>
                                        renderItem(item, entryIdx * 1000 + i)
                                      )}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExamplesRevealed(true);
                                  }}
                                  className="mt-2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  aria-label="Show more"
                                >
                                  <span aria-hidden>▼</span>
                                </button>
                              )
                            )}
                          </>
                        ) : (
                          <p className="text-lg text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Click to flip</p>
                  </div>
                );
              }

              const entries = nextCardFact?.entries ?? [];
              const t = nextCard.card.template;
              const frontIndices = Array.isArray(t?.[0]) ? t[0] : [0];
              const backIndices = Array.isArray(t?.[1]) ? t[1] : [];
              const frontFields = frontIndices.map((i) => entries[i] ?? "");
              const backFieldsList = backIndices.map((i) => entries[i] ?? "");
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
                    className="relative min-h-[10rem] w-full transition-transform duration-300 [transform-style:preserve-3d]"
                    style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                  >
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border bg-card p-4 text-center [backface-visibility:hidden]"
                      style={{ transform: "rotateY(0deg)" }}
                    >
                      <div className="flex flex-wrap items-center justify-center gap-3 text-lg">
                        {frontFields.map((fieldText, i) => (
                          <FieldWithMedia
                            key={i}
                            text={fieldText ?? ""}
                            token={authToken ?? null}
                            imageRevealed={imageRevealed}
                            onRevealImage={() => setImageRevealed(true)}
                          />
                        ))}
                      </div>
                    </div>
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-lg border bg-muted/50 p-4 text-center [backface-visibility:hidden]"
                      style={{ transform: "rotateY(180deg)" }}
                    >
                      {backFieldsList.length > 0 ? (
                        <>
                          <p className="text-lg">
                            <FieldWithMedia text={backFieldsList[0] ?? ""} token={authToken ?? null} />
                          </p>
                          {backFieldsList.length > 1 && (
                            <>
                              {examplesRevealed ? (
                                <div className="mt-3 space-y-2 text-left">
                                  {backFieldsList.slice(1).map((text, i) => (
                                    <p key={i} className="text-base">
                                      <FieldWithMedia text={text ?? ""} token={authToken ?? null} />
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExamplesRevealed(true);
                                  }}
                                  className="mt-2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  aria-label="Show more"
                                >
                                  <span aria-hidden>▼</span>
                                </button>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <p className="text-lg text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Click to flip</p>
                </div>
              );
            })()}
            {hasFlippedOnce && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Hard</span>
                  <span>{formatInterval(intervalSec)}</span>
                  <span>Easy</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={sliderValue}
                  onChange={(e) => setSliderValue(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                />
                <div className="flex justify-center">
                  <Button type="button" className="h-8 px-3 text-xs" onClick={handleSubmit} disabled={loadingNextCard}>
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
                      {i < (deck.field?.length ?? 0) ? deck.field![i] : `field ${i + 1}`}
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
