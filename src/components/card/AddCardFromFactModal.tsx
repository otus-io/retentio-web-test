import { useRef, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DeckItem, Entry, FactItem } from "@/lib/api";
import { request, uploadMultipart, debugLog, fileLooksLikeJson } from "@/lib/api";
import type { UploadMediaRes } from "@/lib/api";
import {
  buildSiblingTemplate,
  buildTemplateWithSplit,
  type AddCardForFactReq,
  type AddFactReq,
  type AddFactRes,
} from "@/lib/api";

const DRAG_TYPE_FIELD = "text/plain";
const DRAG_TYPE_SPLIT = "application/x-wordupx-split";

type FactMediaEntry = { file: File; type: "image" | "audio" | "video" | "json"; fieldName: string };

type AddCardCell =
  | { type: "text"; value: string; label: string }
  | { type: "existing_media"; kind: "image" | "audio" | "video" | "json"; id: string; fieldName: string }
  | { type: "media"; entry: FactMediaEntry };

function getMediaType(file: File): "image" | "audio" | "video" | "json" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (fileLooksLikeJson(file)) return "json";
  return "audio";
}

function factToRow(fact: FactItem, deck: DeckItem): AddCardCell[] {
  const fields = deck.fields ?? [];
  return fact.entries.map((entry: Entry, i) => {
    if (entry.audio)
      return {
        type: "existing_media" as const,
        kind: "audio" as const,
        id: entry.audio,
        fieldName: fields[i] ?? "audio",
      };
    if (entry.image)
      return {
        type: "existing_media" as const,
        kind: "image" as const,
        id: entry.image,
        fieldName: fields[i] ?? "img",
      };
    if (entry.video)
      return {
        type: "existing_media" as const,
        kind: "video" as const,
        id: entry.video,
        fieldName: fields[i] ?? "video",
      };
    if (entry.json)
      return {
        type: "existing_media" as const,
        kind: "json" as const,
        id: entry.json,
        fieldName: fields[i] ?? "json",
      };
    return { type: "text" as const, value: entry.text ?? "", label: fields[i] ?? "" };
  });
}

function contentUnchanged(original: FactItem, row: AddCardCell[]): boolean {
  if (original.entries.length !== row.length) return false;
  const hasNewMedia = row.some((c) => c.type === "media");
  if (hasNewMedia) return false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    const orig = original.entries[i];
    if (c.type === "text" && c.value !== (orig.text ?? "")) return false;
    if (c.type === "existing_media") {
      const origId =
        c.kind === "audio"
          ? orig.audio
          : c.kind === "image"
            ? orig.image
            : c.kind === "video"
              ? orig.video
              : orig.json;
      if (origId !== c.id) return false;
    }
  }
  return true;
}

interface AddCardFromFactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: DeckItem;
  fact: FactItem;
  token: string | null;
  onSuccess: () => void;
}

export function AddCardFromFactModal({
  open,
  onOpenChange,
  deck,
  fact,
  token,
  onSuccess,
}: AddCardFromFactModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fieldNames = deck.fields ?? [];
  const [row, setRow] = useState<AddCardCell[]>(() => factToRow(fact, deck));
  const [split, setSplit] = useState(1);
  const [sibling, setSibling] = useState(false);
  const [frontCollapsed, setFrontCollapsed] = useState(false);
  const [backCollapsed, setBackCollapsed] = useState(false);
  const [dropTargetRow, setDropTargetRow] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRow(factToRow(fact, deck));
      setSplit(1);
      setSibling(false);
      setFrontCollapsed(false);
      setBackCollapsed(false);
      setError("");
    }
  }, [open, fact, deck]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const fieldCount = row.length;
  const maxSplit = fieldCount <= 1 ? 1 : fieldCount;
  const splitVal = Math.min(Math.max(1, split), maxSplit);

  const getDisplayLabel = (colIndex: number) => {
    const c = row[colIndex];
    if (!c) return "";
    if (c.type === "text") return c.label;
    if (c.type === "existing_media") return c.fieldName;
    return c.entry.fieldName;
  };

  const setCell = (colIndex: number, value: string) => {
    setRow((prev) =>
      prev.map((c, i) => (i === colIndex && c.type === "text" ? { ...c, value } : c))
    );
  };

  const setTextLabel = (colIndex: number, value: string) => {
    setRow((prev) =>
      prev.map((c, i) =>
        i === colIndex && c.type === "text" ? { ...c, label: value } : c
      )
    );
  };

  const setMediaFieldName = (cellIndex: number, value: string) => {
    setRow((prev) =>
      prev.map((c, i) => {
        if (i !== cellIndex) return c;
        if (c.type === "existing_media") return { ...c, fieldName: value };
        if (c.type === "media") return { ...c, entry: { ...c.entry, fieldName: value } };
        return c;
      })
    );
  };

  const moveSlot = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setRow((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  };

  const removeCell = (colIndex: number) => {
    if (row.length <= 1) return;
    const newLength = row.length - 1;
    setSplit((prev) => Math.min(prev, newLength <= 1 ? 1 : newLength));
    setRow((prev) => prev.filter((_, i) => i !== colIndex));
  };

  const addField = () => {
    const label = fieldNames[row.length] ?? "";
    setRow((prev) => [...prev, { type: "text", value: "", label }]);
    setSplit((prev) => Math.min(prev, row.length + 1));
  };

  const addMediaDisabled =
    submitting ||
    row.filter((c): c is AddCardCell & { type: "media" } => c.type === "media").length +
      row.filter((c): c is AddCardCell & { type: "existing_media" } => c.type === "existing_media").length >=
      2;

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // #region agent log
    console.log("[debug] AddCardFromFactModal: handleMediaSelect start (H2), files:", (e.target.files ?? []).length);
    debugLog({
      sessionId: "ff1dd3",
      location: "AddCardFromFactModal:handleMediaSelect:start",
      message: "file input change",
      data: { filesCount: (e.target.files ?? []).length },
      hypothesisId: "H2",
      timestamp: Date.now(),
    });
    // #endregion
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    const mediaCount = row.filter(
      (c): c is AddCardCell & { type: "media" } => c.type === "media"
    ).length;
    const existingCount = row.filter(
      (c): c is AddCardCell & { type: "existing_media" } => c.type === "existing_media"
    ).length;
    const totalMedia = mediaCount + existingCount;
    const valid = chosen.filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.type.startsWith("audio/") ||
        f.type.startsWith("video/") ||
        fileLooksLikeJson(f)
    );
    const toAdd = valid.slice(0, Math.max(0, 2 - totalMedia)).map((file) => {
      const type = getMediaType(file);
      return {
        file,
        type,
        fieldName:
          type === "audio"
            ? "audio"
            : type === "video"
              ? "video"
              : type === "json"
                ? "json"
                : "img",
      };
    });
    if (toAdd.length)
      setRow((prev) => [
        ...prev,
        ...toAdd.map((entry) => ({ type: "media" as const, entry })),
      ]);
    // #region agent log
    console.log("[debug] AddCardFromFactModal: after setRow (H3), toAddLen:", toAdd.length);
    debugLog({
      sessionId: "ff1dd3",
      location: "AddCardFromFactModal:handleMediaSelect:afterSetRow",
      message: "after setRow",
      data: { toAddLen: toAdd.length },
      hypothesisId: "H3",
      timestamp: Date.now(),
    });
    // #endregion
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !deck?.id) return;
    const hasContent = row.some(
      (c) => (c.type === "text" ? c.value.trim() !== "" : true)
    );
    if (!hasContent) {
      setError("At least one field is required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const deckId = deck.id;
      const unchanged = contentUnchanged(fact, row);

      // Add card(s) from existing fact: POST /api/decks/{id}/card with fact_id + template.
      if (unchanged) {
        const templates = sibling
          ? buildSiblingTemplate(fieldCount, splitVal)
          : [buildTemplateWithSplit(fieldCount, splitVal)];
        for (const template of templates) {
          const body: AddCardForFactReq = { fact_id: fact.id, template };
          await request<{ data: { card_id?: string }; meta?: { msg?: string } }>(
            `/api/decks/${deckId}/card`,
            {
              method: "POST",
              token,
              body: JSON.stringify(body),
            }
          );
        }
      } else {
        const mediaCells = row.filter(
          (c): c is AddCardCell & { type: "media" } => c.type === "media"
        );
        const uploadedMarkers: {
          id: string;
          type: "image" | "audio" | "video" | "json";
          fieldName: string;
        }[] = [];
        if (mediaCells.length > 0) {
          for (const { entry } of mediaCells) {
            const formData = new FormData();
            formData.append("file", entry.file);
            const res = (await uploadMultipart(
              "/api/media",
              formData,
              token
            )) as UploadMediaRes;
            const id = res?.data?.id != null ? String(res.data.id).trim() : "";
            if (!id) throw new Error("Upload response missing media id");
            uploadedMarkers.push({
              id,
              type: entry.type,
              fieldName:
                entry.fieldName ||
                (entry.type === "audio"
                  ? "audio"
                  : entry.type === "video"
                    ? "video"
                    : entry.type === "json"
                      ? "json"
                      : "img"),
            });
          }
        }
        let mi = 0;
        const entries: Entry[] = row.map((c) => {
          if (c.type === "text") return { text: c.value.trim() };
          if (c.type === "existing_media")
            return c.kind === "audio"
              ? { audio: c.id }
              : c.kind === "video"
                ? { video: c.id }
                : c.kind === "json"
                  ? { json: c.id }
                  : { image: c.id };
          const m = uploadedMarkers[mi++];
          return m.type === "audio"
            ? { audio: m.id }
            : m.type === "video"
              ? { video: m.id }
              : m.type === "json"
                ? { json: m.id }
                : { image: m.id };
        });
        const templateOpt = sibling
          ? { template: buildSiblingTemplate(row.length, splitVal) }
          : splitVal !== 1
            ? { template: [buildTemplateWithSplit(row.length, splitVal)] }
            : {};
        const body: AddFactReq = {
          facts: [{ entries }],
          ...templateOpt,
        };
        await request<AddFactRes>(`/api/decks/${deckId}/facts/append`, {
          method: "POST",
          token,
          body: JSON.stringify(body),
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add card");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const renderCell = (cell: AddCardCell, colIndex: number) => {
    if (cell.type === "text") {
      return (
        <>
          {(fieldNames.includes(cell.label) || !cell.label) ? (
            <span className="flex h-10 w-20 shrink-0 items-center text-sm font-medium">
              {cell.label || `Field ${colIndex + 1}`}
            </span>
          ) : (
            <Input
              aria-label="Field name"
              placeholder={`Field ${colIndex + 1}`}
              value={cell.label}
              onChange={(e) => setTextLabel(colIndex, e.target.value)}
              disabled={submitting}
              className="!w-20 !px-0 h-10 shrink-0 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none placeholder:text-foreground/50"
            />
          )}
          <Input
            placeholder="Value"
            value={cell.value}
            onChange={(e) => setCell(colIndex, e.target.value)}
            disabled={submitting}
            className="!w-auto min-w-0 flex-1"
          />
        </>
      );
    }
    if (cell.type === "existing_media") {
      const kindLabel =
        cell.kind === "image"
          ? "Image"
          : cell.kind === "video"
            ? "Video"
            : cell.kind === "json"
              ? "JSON"
              : "Audio";
      const kindClass =
        cell.kind === "image"
          ? "text-amber-600"
          : cell.kind === "video"
            ? "text-green-600"
            : cell.kind === "json"
              ? "text-violet-600"
              : "text-blue-600";
      return (
        <>
          <span className={`${kindClass} text-sm font-medium w-20 shrink-0`}>{kindLabel}</span>
          <Input
            aria-label="Field name"
            value={cell.fieldName}
            onChange={(e) => setMediaFieldName(colIndex, e.target.value)}
            disabled={submitting}
            className="!w-20 !px-0 h-10 shrink-0 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none"
          />
          <span className="max-w-[100px] truncate text-muted-foreground text-xs shrink-0">
            (existing)
          </span>
        </>
      );
    }
    const typeLabel =
      cell.entry.type === "image"
        ? "Image"
        : cell.entry.type === "video"
          ? "Video"
          : cell.entry.type === "json"
            ? "JSON"
            : "Audio";
    const typeClass =
      cell.entry.type === "image"
        ? "text-amber-600"
        : cell.entry.type === "video"
          ? "text-green-600"
          : cell.entry.type === "json"
            ? "text-violet-600"
            : "text-blue-600";
    return (
      <>
        <span className={`${typeClass} text-sm font-medium w-20 shrink-0`}>{typeLabel}</span>
        <Input
          aria-label="Field name"
          value={cell.entry.fieldName}
          onChange={(e) => setMediaFieldName(colIndex, e.target.value)}
          disabled={submitting}
          className="!w-20 !px-0 h-10 shrink-0 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none"
        />
        <span className="max-w-[100px] truncate text-muted-foreground text-xs shrink-0">
          {cell.entry.file.name}
        </span>
      </>
    );
  };

  const rowClass = (colIndex: number) =>
    `flex items-center gap-2 flex-nowrap rounded-md border p-1 -m-1 transition-colors group ${
      dropTargetRow === colIndex
        ? "border-transparent border-b-4 border-b-primary"
        : "border-transparent hover:border-input/50 bg-transparent hover:bg-muted/30"
    }`;

  const dragHandlers = (colIndex: number) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTargetRow(colIndex);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDropTargetRow(null);
      const splitDrag = e.dataTransfer.getData(DRAG_TYPE_SPLIT);
      if (splitDrag) {
        setSplit(Math.min(maxSplit, Math.max(1, colIndex + 1)));
        return;
      }
      const from = parseInt(e.dataTransfer.getData(DRAG_TYPE_FIELD), 10);
      if (!Number.isNaN(from) && from !== colIndex) moveSlot(from, colIndex);
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-card-from-fact-title"
    >
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => !submitting && onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle id="add-card-from-fact-title">Duplicate card</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Edit if needed. Add fields and media; drag the cut line to set front vs back.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="space-y-2">
                {fieldCount > 1 && splitVal > 0 && (
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 min-w-0 space-y-2">
                      {!frontCollapsed &&
                        row.slice(0, splitVal).map((cell, i) => {
                          const colIndex = i;
                          return (
                            <div
                              key={colIndex}
                              {...dragHandlers(colIndex)}
                              className={rowClass(colIndex)}
                            >
                              <span
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData(DRAG_TYPE_FIELD, String(colIndex));
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => setDropTargetRow(null)}
                                className="flex h-10 w-8 shrink-0 cursor-grab active:cursor-grabbing items-center justify-center text-muted-foreground hover:text-foreground"
                                aria-label="Drag to reorder"
                                tabIndex={-1}
                              >
                                ⋮⋮
                              </span>
                              <Label className="sr-only">{getDisplayLabel(colIndex)}</Label>
                              {renderCell(cell, colIndex)}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => removeCell(colIndex)}
                                disabled={submitting}
                                aria-label="Remove field"
                              >
                                ×
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFrontCollapsed((c) => !c)}
                      className="flex w-20 shrink-0 items-center justify-center border-l border-input pl-2 text-muted-foreground hover:text-foreground"
                      aria-label={frontCollapsed ? "Expand front" : "Collapse front"}
                    >
                      <span className="text-xs font-medium">Front</span>
                    </button>
                  </div>
                )}

                {fieldCount === 1 && row.length > 0 && (
                  <div className="space-y-2">
                    {row.map((cell, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 flex-nowrap rounded-md border border-transparent hover:border-input/50 bg-transparent p-1 -m-1"
                      >
                        <span className="flex h-10 w-8 shrink-0" aria-hidden />
                        <Label className="sr-only">{getDisplayLabel(i)}</Label>
                        {renderCell(cell, i)}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCell(i)}
                          disabled={submitting}
                          aria-label="Remove"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {fieldCount > 1 && (
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_TYPE_SPLIT, "1");
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDropTargetRow(null)}
                    className="flex w-full cursor-grab active:cursor-grabbing py-1"
                    aria-label="Drag cut line; drop on a field row to set front/back split."
                  >
                    <div className="flex-1 min-w-0">
                      <hr className="border-input" />
                    </div>
                    <div className="w-20 shrink-0" aria-hidden />
                  </div>
                )}

                {fieldCount > 1 && (
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 min-w-0 space-y-2">
                      {!backCollapsed &&
                        row.slice(splitVal).map((cell, i) => {
                          const colIndex = splitVal + i;
                          return (
                            <div
                              key={colIndex}
                              {...dragHandlers(colIndex)}
                              className={rowClass(colIndex)}
                            >
                              <span
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData(DRAG_TYPE_FIELD, String(colIndex));
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => setDropTargetRow(null)}
                                className="flex h-10 w-8 shrink-0 cursor-grab active:cursor-grabbing items-center justify-center text-muted-foreground hover:text-foreground"
                                aria-label="Drag to reorder"
                                tabIndex={-1}
                              >
                                ⋮⋮
                              </span>
                              <Label className="sr-only">{getDisplayLabel(colIndex)}</Label>
                              {renderCell(cell, colIndex)}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => removeCell(colIndex)}
                                disabled={submitting}
                                aria-label="Remove field"
                              >
                                ×
                              </Button>
                            </div>
                          );
                        })}
                      {!backCollapsed && splitVal < fieldCount && (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDropTargetRow(fieldCount);
                          }}
                          onDragLeave={() => setDropTargetRow(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDropTargetRow(null);
                            if (e.dataTransfer.getData(DRAG_TYPE_SPLIT)) setSplit(fieldCount);
                          }}
                          className={`rounded-md border border-dashed py-2 text-center text-xs text-muted-foreground ${
                            dropTargetRow === fieldCount ? "border-primary bg-primary/10" : "border-input hover:bg-muted/30"
                          }`}
                        >
                          Drop cut line here for front only
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBackCollapsed((c) => !c)}
                      className="flex w-20 shrink-0 items-center justify-center border-l border-input pl-2 text-muted-foreground hover:text-foreground"
                      aria-label={backCollapsed ? "Expand back" : "Collapse back"}
                    >
                      <span className="text-xs font-medium">Back</span>
                    </button>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addField}
                  disabled={submitting}
                >
                  Add field
                </Button>
                <input
                  ref={fileInputRef}
                  id="add-card-media-input"
                  type="file"
                  accept="image/*,audio/*,video/*,application/json,.json"
                  multiple
                  onChange={handleMediaSelect}
                  className="hidden"
                  aria-hidden
                  tabIndex={-1}
                />
                <label
                  htmlFor="add-card-media-input"
                  role="button"
                  onClick={(e) => addMediaDisabled && e.preventDefault()}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&:has(input:disabled)]:pointer-events-none [&:has(input:disabled)]:opacity-50"
                  style={addMediaDisabled ? { pointerEvents: "none", opacity: 0.5 } : undefined}
                >
                  Add media
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sibling}
                    onChange={(e) => setSibling(e.target.checked)}
                    disabled={submitting}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Sibling</span>
                </label>
                <p className="text-xs text-muted-foreground font-mono">
                  Template:{" "}
                  {sibling
                    ? JSON.stringify(buildSiblingTemplate(row.length, splitVal))
                    : splitVal !== 1
                      ? JSON.stringify([buildTemplateWithSplit(row.length, splitVal)])
                      : "default"}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : "Duplicate"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
