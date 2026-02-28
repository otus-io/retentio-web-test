import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DeckItem } from "@/lib/api";
import type { AddFactOperation } from "@/lib/api";
import { buildSiblingTemplate, buildTemplateWithSplit } from "@/lib/api";

export type FactMediaEntry = { file: File; type: "image" | "audio"; fieldName: string };

export type FactCell =
  | { type: "text"; value: string; label: string }
  | { type: "media"; entry: FactMediaEntry };

export function makeInitialFactRow(deck: DeckItem): FactCell[] {
  const fields = deck.field ?? [];
  if (fields.length === 0) return [{ type: "text", value: "", label: "Field 1" }];
  return fields.map((label) => ({ type: "text" as const, value: "", label }));
}

const DRAG_TYPE_FIELD = "text/plain";
const DRAG_TYPE_SPLIT = "application/x-wordupx-split";

function getMediaType(file: File): "image" | "audio" {
  return file.type.startsWith("image/") ? "image" : "audio";
}

/** Field name suffix for media: "audio" or "img" (matches backend convention). */
function getMediaFieldNameSuffix(type: "image" | "audio"): "audio" | "img" {
  return type === "audio" ? "audio" : "img";
}

interface AddFactsFormProps {
  deck: DeckItem;
  factRow: FactCell[];
  setFactRow: (v: FactCell[]) => void;
  addFactOp: AddFactOperation;
  setAddFactOp: (v: AddFactOperation) => void;
  addFactSplit: number;
  setAddFactSplit: React.Dispatch<React.SetStateAction<number>>;
  sibling: boolean;
  setSibling: (v: boolean) => void;
  addingFacts: boolean;
  addFactsError: string;
  onSubmit: (e: React.FormEvent) => void;
}

export function AddFactsForm({
  deck,
  factRow,
  setFactRow,
  addFactOp,
  setAddFactOp,
  addFactSplit,
  setAddFactSplit,
  sibling,
  setSibling,
  addingFacts,
  addFactsError,
  onSubmit,
}: AddFactsFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const row = factRow;
  const [frontCollapsed, setFrontCollapsed] = useState(false);
  const [backCollapsed, setBackCollapsed] = useState(false);
  const [dropTargetRow, setDropTargetRow] = useState<number | null>(null);

  const setCell = (colIndex: number, value: string) => {
    const next = row.map((c, i) =>
      i === colIndex && c.type === "text" ? { ...c, value } : c
    );
    setFactRow(next);
  };
  const moveSlot = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...row];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setFactRow(next);
  };
  const addField = () => {
    const textCount = row.filter((c): c is FactCell & { type: "text" } => c.type === "text").length;
    const label = (deck.field ?? [])[textCount] ?? `Field ${textCount + 1}`;
    setFactRow([...row, { type: "text", value: "", label }]);
    setAddFactSplit((prev) => Math.min(prev, row.length + 1));
  };
  const removeCell = (colIndex: number) => {
    if (row.length <= 1) return;
    const next = row.filter((_, i) => i !== colIndex);
    setFactRow(next);
    setAddFactSplit((prev) => Math.min(prev, next.length <= 1 ? 1 : next.length));
  };
  const setTextLabel = (colIndex: number, value: string) => {
    setFactRow(
      row.map((c, i) =>
        i === colIndex && c.type === "text" ? { ...c, label: value } : c
      )
    );
  };
  const fieldCount = row.length;
  const maxSplit = fieldCount <= 1 ? 1 : fieldCount;
  const split = Math.min(Math.max(1, addFactSplit), maxSplit);
  const getDisplayLabel = (colIndex: number) => {
    const c = row[colIndex];
    if (!c) return "";
    return c.type === "text" ? c.label : c.entry.fieldName;
  };

  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    const mediaCount = row.filter((c): c is FactCell & { type: "media" } => c.type === "media").length;
    const valid = chosen.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("audio/")
    );
    const toAdd = valid.slice(0, Math.max(0, 2 - mediaCount)).map((file) => ({
      file,
      type: getMediaType(file),
      fieldName: getMediaFieldNameSuffix(getMediaType(file)),
    }));
    if (toAdd.length) setFactRow([...row, ...toAdd.map((entry) => ({ type: "media" as const, entry }))]);
  }

  function setMediaFieldName(cellIndex: number, value: string) {
    setFactRow(
      row.map((c, i) =>
        i === cellIndex && c.type === "media"
          ? { ...c, entry: { ...c.entry, fieldName: value } }
          : c
      )
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Add facts</CardTitle>
        <p className="text-sm font-normal text-muted-foreground">
          Enter one fact. Add fields and media; drag the cut line to set front vs back.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {addFactsError && <p className="text-sm text-destructive">{addFactsError}</p>}
          <div className="space-y-2">
            {/* Front section: fields + Front label */}
            {fieldCount > 1 && split > 0 && (
              <div className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0 space-y-2">
                  {!frontCollapsed &&
                    row.slice(0, split).map((cell, i) => {
                      const colIndex = i;
                      return (
                        <div
                          key={colIndex}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setDropTargetRow(colIndex);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDropTargetRow(null);
                            const splitDrag = e.dataTransfer.getData(DRAG_TYPE_SPLIT);
                            if (splitDrag) {
                              setAddFactSplit(Math.min(maxSplit, Math.max(1, colIndex + 1)));
                              return;
                            }
                            const from = parseInt(e.dataTransfer.getData(DRAG_TYPE_FIELD), 10);
                            if (!Number.isNaN(from) && from !== colIndex) moveSlot(from, colIndex);
                          }}
                          className={`flex items-center gap-2 flex-nowrap rounded-md border p-1 -m-1 transition-colors group ${dropTargetRow === colIndex ? "border-transparent border-b-4 border-b-primary" : "border-transparent hover:border-input/50 bg-transparent hover:bg-muted/30"}`}
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
                          <Label htmlFor={cell.type === "text" ? `fact-0-${colIndex}` : undefined} className="sr-only">
                            {getDisplayLabel(colIndex)}
                          </Label>
                          {cell.type === "text" ? (
                            <>
                              {(deck.field ?? []).includes(cell.label) ? (
                                <span className="flex h-10 w-20 shrink-0 items-center text-sm font-medium">
                                  {cell.label}
                                </span>
                              ) : (
                                <Input
                                  aria-label="Field name"
                                  placeholder={`Field ${colIndex + 1}`}
                                  value={cell.label}
                                  onChange={(e) => setTextLabel(colIndex, e.target.value)}
                                  disabled={addingFacts}
                                  className="!w-20 !px-0 h-10 shrink-0 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none placeholder:text-foreground/50"
                                />
                              )}
                              <Input
                                id={`fact-0-${colIndex}`}
                                placeholder="Value"
                                value={cell.value}
                                onChange={(e) => setCell(colIndex, e.target.value)}
                                disabled={addingFacts}
                                className="!w-auto min-w-0 flex-1"
                              />
                            </>
                          ) : (
                            <>
                              <span
                                className={
                                  cell.entry.type === "image"
                                    ? "text-amber-600 text-sm font-medium w-20 shrink-0"
                                    : "text-blue-600 text-sm font-medium w-20 shrink-0"
                                }
                              >
                                {cell.entry.type === "image" ? "Image" : "Audio"}
                              </span>
                              <Input
                                type="text"
                                value={cell.entry.fieldName}
                                onChange={(e) => setMediaFieldName(colIndex, e.target.value)}
                                placeholder={cell.entry.type === "image" ? "img" : "audio"}
                                className="h-9 w-24 text-xs flex-1 min-w-0"
                                disabled={addingFacts}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="max-w-[100px] truncate text-muted-foreground text-xs shrink-0">
                                {cell.entry.file.name}
                              </span>
                            </>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeCell(colIndex)}
                            disabled={addingFacts}
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
                  aria-label={frontCollapsed ? "Expand front fields" : "Collapse front fields"}
                >
                  <span className="text-xs font-medium">Front</span>
                </button>
              </div>
            )}

            {fieldCount === 1 && row.length > 0 && (
              <div className="space-y-2">
                {row.map((cell, i) => {
                  const colIndex = i;
                  return (
                    <div
                      key={colIndex}
                      className="flex items-center gap-2 flex-nowrap rounded-md border border-transparent hover:border-input/50 bg-transparent p-1 -m-1"
                    >
                      <span className="flex h-10 w-8 shrink-0" aria-hidden />
                      {cell.type === "text" ? (
                        <>
                          <Label htmlFor={`fact-0-${colIndex}`} className="sr-only">
                            {cell.label}
                          </Label>
                          <span className="flex h-10 w-20 shrink-0 items-center text-sm font-medium">
                            {cell.label}
                          </span>
                          <Input
                            id={`fact-0-${colIndex}`}
                            placeholder="Value"
                            value={cell.value}
                            onChange={(e) => setCell(colIndex, e.target.value)}
                            disabled={addingFacts}
                            className="!w-auto min-w-0 flex-1"
                          />
                        </>
                      ) : (
                        <>
                          <span className={cell.entry.type === "image" ? "text-amber-600 text-sm w-20" : "text-blue-600 text-sm w-20"}>
                            {cell.entry.type === "image" ? "Image" : "Audio"}
                          </span>
                          <Input
                            type="text"
                            value={cell.entry.fieldName}
                            onChange={(e) => setMediaFieldName(colIndex, e.target.value)}
                            className="h-9 w-24 text-xs"
                            disabled={addingFacts}
                          />
                          <span className="truncate text-muted-foreground text-xs">{cell.entry.file.name}</span>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeCell(colIndex)} aria-label="Remove">×</Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Draggable cut line */}
            {fieldCount > 1 && (
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_TYPE_SPLIT, "1");
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDropTargetRow(null)}
                className="flex w-full cursor-grab active:cursor-grabbing py-1"
                aria-label="Drag cut line; drop on a field row to set how many fields are on front."
              >
                <div className="flex-1 min-w-0">
                  <hr className="border-input" />
                </div>
                <div className="w-20 shrink-0" aria-hidden />
              </div>
            )}

            {/* Back section: fields + Back label */}
            {fieldCount > 1 && (
              <div className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0 space-y-2">
                  {!backCollapsed &&
                    row.slice(split).map((cell, i) => {
                      const colIndex = split + i;
                      return (
                        <div
                          key={colIndex}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setDropTargetRow(colIndex);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDropTargetRow(null);
                            const splitDrag = e.dataTransfer.getData(DRAG_TYPE_SPLIT);
                            if (splitDrag) {
                              setAddFactSplit(Math.min(maxSplit, Math.max(1, colIndex + 1)));
                              return;
                            }
                            const from = parseInt(e.dataTransfer.getData(DRAG_TYPE_FIELD), 10);
                            if (!Number.isNaN(from) && from !== colIndex) moveSlot(from, colIndex);
                          }}
                          className={`flex items-center gap-2 flex-nowrap rounded-md border p-1 -m-1 transition-colors group ${dropTargetRow === colIndex ? "border-transparent border-b-4 border-b-primary" : "border-transparent hover:border-input/50 bg-transparent hover:bg-muted/30"}`}
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
                          <Label htmlFor={cell.type === "text" ? `fact-0-${colIndex}` : undefined} className="sr-only">
                            {getDisplayLabel(colIndex)}
                          </Label>
                          {cell.type === "text" ? (
                            <>
                              {(deck.field ?? []).includes(cell.label) ? (
                                <span className="flex h-10 w-20 shrink-0 items-center text-sm font-medium">
                                  {cell.label}
                                </span>
                              ) : (
                                <Input
                                  aria-label="Field name"
                                  placeholder={`Field ${colIndex + 1}`}
                                  value={cell.label}
                                  onChange={(e) => setTextLabel(colIndex, e.target.value)}
                                  disabled={addingFacts}
                                  className="!w-20 !px-0 h-10 shrink-0 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none placeholder:text-foreground/50"
                                />
                              )}
                              <Input
                                id={`fact-0-${colIndex}`}
                                placeholder="Value"
                                value={cell.value}
                                onChange={(e) => setCell(colIndex, e.target.value)}
                                disabled={addingFacts}
                                className="!w-auto min-w-0 flex-1"
                              />
                            </>
                          ) : (
                            <>
                              <span
                                className={
                                  cell.entry.type === "image"
                                    ? "text-amber-600 text-sm font-medium w-20 shrink-0"
                                    : "text-blue-600 text-sm font-medium w-20 shrink-0"
                                }
                              >
                                {cell.entry.type === "image" ? "Image" : "Audio"}
                              </span>
                              <Input
                                type="text"
                                value={cell.entry.fieldName}
                                onChange={(e) => setMediaFieldName(colIndex, e.target.value)}
                                placeholder={cell.entry.type === "image" ? "img" : "audio"}
                                className="h-9 w-24 text-xs flex-1 min-w-0"
                                disabled={addingFacts}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="max-w-[100px] truncate text-muted-foreground text-xs shrink-0">
                                {cell.entry.file.name}
                              </span>
                            </>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeCell(colIndex)}
                            disabled={addingFacts}
                            aria-label="Remove field"
                          >
                            ×
                          </Button>
                        </div>
                      );
                    })}
                  {/* Drop cut line at very bottom for front only */}
                  {!backCollapsed && split < fieldCount && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDropTargetRow(fieldCount);
                      }}
                      onDragLeave={() => setDropTargetRow(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDropTargetRow(null);
                        if (e.dataTransfer.getData(DRAG_TYPE_SPLIT)) {
                          setAddFactSplit(fieldCount);
                        }
                      }}
                      className={`rounded-md border border-dashed py-2 text-center text-xs text-muted-foreground transition-colors ${dropTargetRow === fieldCount ? "border-primary bg-primary/10" : "border-input hover:bg-muted/30"}`}
                    >
                      Drop cut line here for front only
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setBackCollapsed((c) => !c)}
                  className="flex w-20 shrink-0 items-center justify-center border-l border-input pl-2 text-muted-foreground hover:text-foreground"
                  aria-label={backCollapsed ? "Expand back fields" : "Collapse back fields"}
                >
                  <span className="text-xs font-medium">Back</span>
                </button>
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addField} disabled={addingFacts}>
              Add field
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,audio/*"
              multiple
              onChange={handleMediaSelect}
              className="hidden"
              aria-hidden
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={addingFacts || row.filter((c): c is FactCell & { type: "media" } => c.type === "media").length >= 2}
              onClick={() => fileInputRef.current?.click()}
            >
              Add media
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="op" className="sr-only">Operation</Label>
            <select
              id="op"
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={addFactOp}
              onChange={(e) => setAddFactOp(e.target.value as AddFactOperation)}
            >
              <option value="append">Append</option>
              <option value="prepend">Prepend</option>
              <option value="shuffle">Shuffle</option>
              <option value="spread">Spread</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                id="add-fact-sibling"
                type="checkbox"
                checked={sibling}
                onChange={(e) => setSibling(e.target.checked)}
                className="h-4 w-4 rounded border-input"
                disabled={addingFacts}
              />
              <Label htmlFor="add-fact-sibling" className="font-normal cursor-pointer text-sm">
                Sibling
              </Label>
            </div>
            <p className="text-xs text-muted-foreground font-mono" data-testid="add-facts-template">
              Template:{" "}
              {sibling
                ? JSON.stringify(buildSiblingTemplate(row.length, split))
                : split !== 1
                  ? JSON.stringify([buildTemplateWithSplit(row.length, split)])
                  : "default (0 front, rest back)"}
            </p>
            <Button
              type="submit"
              disabled={
                addingFacts ||
                !row.some((c) => (c.type === "text" ? c.value.trim() !== "" : true))
              }
            >
              {addingFacts ? "Adding…" : "Add facts"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
