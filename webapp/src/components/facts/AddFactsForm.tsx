import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DeckItem } from "@/lib/api";
import type { AddFactOperation } from "@/lib/api";

export type FactMediaEntry = { file: File; type: "image" | "audio" };

const DRAG_TYPE_FIELD = "text/plain";
const DRAG_TYPE_SPLIT = "application/x-wordupx-split";

function getMediaType(file: File): "image" | "audio" {
  return file.type.startsWith("image/") ? "image" : "audio";
}

interface AddFactsFormProps {
  deck: DeckItem;
  factsRows: string[][];
  setFactsRows: (v: string[][]) => void;
  addFactOp: AddFactOperation;
  setAddFactOp: (v: AddFactOperation) => void;
  addFactSplit: number;
  setAddFactSplit: (v: number) => void;
  sibling: boolean;
  setSibling: (v: boolean) => void;
  addingFacts: boolean;
  addFactsError: string;
  onSubmit: (e: React.FormEvent) => void;
  mediaFiles: FactMediaEntry[];
  setMediaFiles: (v: FactMediaEntry[]) => void;
}

export function AddFactsForm({
  deck,
  factsRows,
  setFactsRows,
  addFactOp,
  setAddFactOp,
  addFactSplit,
  setAddFactSplit,
  sibling,
  setSibling,
  addingFacts,
  addFactsError,
  onSubmit,
  mediaFiles,
  setMediaFiles,
}: AddFactsFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const row = factsRows[0] ?? [""];
  const N = (deck.field ?? []).length;
  const [slotLabelIndex, setSlotLabelIndex] = useState<number[]>(() =>
    row.map((_, i) => i)
  );
  const [customLabels, setCustomLabels] = useState<string[]>(() =>
    Array(row.length).fill("")
  );
  const [frontCollapsed, setFrontCollapsed] = useState(false);
  const [backCollapsed, setBackCollapsed] = useState(false);
  const [dropTargetRow, setDropTargetRow] = useState<number | null>(null);

  useEffect(() => {
    if (slotLabelIndex.length !== row.length) {
      setSlotLabelIndex(Array.from({ length: row.length }, (_, i) => i));
    }
    if (customLabels.length !== row.length) {
      if (row.length > customLabels.length) {
        setCustomLabels((prev) => [...prev, ...Array(row.length - customLabels.length).fill("")]);
      } else {
        setCustomLabels((prev) => prev.slice(0, row.length));
      }
    }
  }, [row.length]);

  const setCell = (colIndex: number, value: string) => {
    const next = [...row];
    next[colIndex] = value;
    setFactsRows([next]);
  };
  const moveSlot = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const nextRow = [...row];
    const nextLabels = [...slotLabelIndex];
    const nextCustom = [...customLabels];
    const [removedRow] = nextRow.splice(fromIndex, 1);
    const [removedLabel] = nextLabels.splice(fromIndex, 1);
    const [removedCustom] = nextCustom.splice(fromIndex, 1);
    nextRow.splice(toIndex, 0, removedRow);
    nextLabels.splice(toIndex, 0, removedLabel);
    nextCustom.splice(toIndex, 0, removedCustom);
    setFactsRows([nextRow]);
    setSlotLabelIndex(nextLabels);
    setCustomLabels(nextCustom);
  };
  const addField = () => {
    const newLen = row.length + 1;
    setFactsRows([[...row, ""]]);
    setSlotLabelIndex(Array.from({ length: newLen }, (_, i) => i));
    setCustomLabels((prev) => [...prev, ""]);
    setAddFactSplit((prev) => Math.min(prev, newLen <= 1 ? 1 : newLen - 1));
  };
  const removeField = (colIndex: number) => {
    if (row.length <= 1) return;
    const next = row.filter((_, i) => i !== colIndex);
    const nextLabels = slotLabelIndex.filter((_, i) => i !== colIndex);
    const nextCustom = customLabels.filter((_, i) => i !== colIndex);
    setFactsRows([next]);
    setSlotLabelIndex(nextLabels);
    setCustomLabels(nextCustom);
    setAddFactSplit((prev) => Math.min(prev, next.length <= 1 ? 1 : next.length - 1));
  };
  const setCustomLabel = (colIndex: number, value: string) => {
    setCustomLabels((prev) => {
      const next = [...prev];
      next[colIndex] = value;
      return next;
    });
  };
  const fieldCount = row.length;
  const maxSplit = fieldCount <= 1 ? 1 : fieldCount - 1;
  const split = Math.min(Math.max(1, addFactSplit), maxSplit);
  const getDisplayLabel = (colIndex: number) => {
    const idx = slotLabelIndex[colIndex] ?? colIndex;
    if (idx < N) return deck.field[idx];
    const custom = customLabels[colIndex];
    return custom.trim() || `Field ${idx + 1}`;
  };

  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    const valid = chosen.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("audio/")
    );
    const toAdd = valid.slice(0, Math.max(0, 2 - mediaFiles.length)).map((file) => ({
      file,
      type: getMediaType(file),
    }));
    if (toAdd.length) setMediaFiles([...mediaFiles, ...toAdd]);
  }

  function removeMedia(index: number) {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Add facts</CardTitle>
        <p className="text-sm font-normal text-muted-foreground">
          Enter one fact. Add as many fields as you need.
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
                    row.slice(0, split).map((value, i) => {
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
                          <Label htmlFor={`fact-0-${colIndex}`} className="sr-only">
                            {getDisplayLabel(colIndex)}
                          </Label>
                          {(slotLabelIndex[colIndex] ?? colIndex) < N ? (
                            <span className="flex h-10 w-20 shrink-0 items-center text-sm font-medium">
                              {deck.field[slotLabelIndex[colIndex] ?? colIndex]}
                            </span>
                          ) : (
                            <Input
                              aria-label="Field name"
                              placeholder={`Field ${(slotLabelIndex[colIndex] ?? colIndex) + 1}`}
                              value={customLabels[colIndex] ?? ""}
                              onChange={(e) => setCustomLabel(colIndex, e.target.value)}
                              disabled={addingFacts}
                              className="!w-20 !px-0 h-10 shrink-0 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none placeholder:text-foreground/50"
                            />
                          )}
                          <Input
                            id={`fact-0-${colIndex}`}
                            placeholder="Value"
                            value={value ?? ""}
                            onChange={(e) => setCell(colIndex, e.target.value)}
                            disabled={addingFacts}
                            className="!w-auto min-w-0 flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeField(colIndex)}
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

            {fieldCount === 1 && (
              <>
                {row.slice(0, split).map((value, i) => {
                  const colIndex = i;
                  return (
                    <div
                      key={colIndex}
                      className="flex items-center gap-2 flex-nowrap rounded-md border border-transparent hover:border-input/50 bg-transparent p-1 -m-1"
                    >
                      <span className="flex h-10 w-8 shrink-0" aria-hidden />
                      <Label htmlFor={`fact-0-${colIndex}`} className="sr-only">
                        {getDisplayLabel(colIndex)}
                      </Label>
                      {(slotLabelIndex[colIndex] ?? colIndex) < N ? (
                        <span className="flex h-10 w-20 shrink-0 items-center text-sm font-medium">
                          {deck.field[slotLabelIndex[colIndex] ?? colIndex]}
                        </span>
                      ) : (
                        <Input
                          aria-label="Field name"
                          placeholder={`Field ${(slotLabelIndex[colIndex] ?? colIndex) + 1}`}
                          value={customLabels[colIndex] ?? ""}
                          onChange={(e) => setCustomLabel(colIndex, e.target.value)}
                          disabled={addingFacts}
                          className="!w-20 !px-0 h-10 shrink-0 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none placeholder:text-foreground/50"
                        />
                      )}
                      <Input
                        id={`fact-0-${colIndex}`}
                        placeholder="Value"
                        value={value ?? ""}
                        onChange={(e) => setCell(colIndex, e.target.value)}
                        disabled={addingFacts}
                        className="!w-auto min-w-0 flex-1"
                      />
                    </div>
                  );
                })}
              </>
            )}

            {fieldCount === 1 && (
              <>
                {row.slice(0, split).map((value, i) => {
                  const colIndex = i;
                  return (
                    <div
                      key={colIndex}
                      className="flex items-center gap-2 flex-nowrap rounded-md border border-transparent hover:border-input/50 bg-transparent p-1 -m-1"
                    >
                      <span className="flex h-10 w-8 shrink-0" aria-hidden />
                      <Label htmlFor={`fact-0-${colIndex}`} className="sr-only">
                        {getDisplayLabel(colIndex)}
                      </Label>
                      {(slotLabelIndex[colIndex] ?? colIndex) < N ? (
                        <span className="flex h-10 w-20 shrink-0 items-center text-sm font-medium">
                          {deck.field[slotLabelIndex[colIndex] ?? colIndex]}
                        </span>
                      ) : (
                        <Input
                          aria-label="Field name"
                          placeholder={`Field ${(slotLabelIndex[colIndex] ?? colIndex) + 1}`}
                          value={customLabels[colIndex] ?? ""}
                          onChange={(e) => setCustomLabel(colIndex, e.target.value)}
                          disabled={addingFacts}
                          className="!w-20 !px-0 h-10 shrink-0 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none placeholder:text-foreground/50"
                        />
                      )}
                      <Input
                        id={`fact-0-${colIndex}`}
                        placeholder="Value"
                        value={value ?? ""}
                        onChange={(e) => setCell(colIndex, e.target.value)}
                        disabled={addingFacts}
                        className="!w-auto min-w-0 flex-1"
                      />
                    </div>
                  );
                })}
              </>
            )}

            {/* Draggable cut line: drag and drop on a row to set front/back split */}
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
                    row.slice(split).map((value, i) => {
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
                          <Label htmlFor={`fact-0-${colIndex}`} className="sr-only">
                            {getDisplayLabel(colIndex)}
                          </Label>
                          {(slotLabelIndex[colIndex] ?? colIndex) < N ? (
                            <span className="flex h-10 w-20 shrink-0 items-center text-sm font-medium">
                              {deck.field[slotLabelIndex[colIndex] ?? colIndex]}
                            </span>
                          ) : (
                            <Input
                              aria-label="Field name"
                              placeholder={`Field ${(slotLabelIndex[colIndex] ?? colIndex) + 1}`}
                              value={customLabels[colIndex] ?? ""}
                              onChange={(e) => setCustomLabel(colIndex, e.target.value)}
                              disabled={addingFacts}
                              className="!w-20 !px-0 h-10 shrink-0 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none placeholder:text-foreground/50"
                            />
                          )}
                          <Input
                            id={`fact-0-${colIndex}`}
                            placeholder="Value"
                            value={value ?? ""}
                            onChange={(e) => setCell(colIndex, e.target.value)}
                            disabled={addingFacts}
                            className="!w-auto min-w-0 flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeField(colIndex)}
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
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Media (optional)</Label>
            <p className="text-xs text-muted-foreground">Up to 2 files, image or audio.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,audio/*"
              multiple
              onChange={handleMediaSelect}
              className="hidden"
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={addingFacts || mediaFiles.length >= 2}
                onClick={() => fileInputRef.current?.click()}
              >
                Add media
              </Button>
              {mediaFiles.map((entry, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-sm"
                >
                  <span
                    className={
                      entry.type === "image"
                        ? "text-amber-600"
                        : "text-blue-600"
                    }
                  >
                    {entry.type === "image" ? "Image" : "Audio"}
                  </span>
                  <span className="max-w-[120px] truncate text-muted-foreground">
                    {entry.file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    className="rounded p-0.5 hover:bg-muted"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
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
            <Button type="submit" disabled={addingFacts || row.every((s) => !s.trim())}>
              {addingFacts ? "Adding…" : "Add facts"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
