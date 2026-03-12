import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { DeckItem } from "@/lib/api";
import type { AddFactOperation } from "@/lib/api";
import { buildSiblingTemplate, buildTemplateWithSplit } from "@/lib/api";

/** One entry in the Add facts row: label, text value, and optional media files. Type is derived from file when uploading. */
export type AddFactEntry = {
  label: string;
  text: string;
  media: { file: File }[];
};

export function makeInitialFactRow(deck: DeckItem): AddFactEntry[] {
  const fields = deck.field ?? [];
  if (fields.length === 0) return [{ label: "", text: "", media: [] }];
  return fields.map((label) => ({ label, text: "", media: [] }));
}

const DRAG_TYPE_FIELD = "text/plain";
const DRAG_TYPE_SPLIT = "application/x-wordupx-split";
const MAX_MEDIA_PER_ENTRY = 4;

interface AddFactsFormProps {
  deck: DeckItem;
  factRow: AddFactEntry[];
  setFactRow: (v: AddFactEntry[]) => void;
  addFactOp: AddFactOperation;
  setAddFactOp: (v: AddFactOperation) => void;
  addFactSplit: number;
  setAddFactSplit: React.Dispatch<React.SetStateAction<number>>;
  sibling: boolean;
  setSibling: (v: boolean) => void;
  addingFacts: boolean;
  addFactsError: string;
  onSubmit: (e: React.FormEvent) => void;
  /** When set, form is in modal: no Card wrapper, and a Cancel button is shown that calls this. */
  onCancel?: () => void;
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
  onCancel,
}: AddFactsFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMediaRowIndex, setPendingMediaRowIndex] = useState<number | null>(null);

  const row = factRow;
  const [frontCollapsed, setFrontCollapsed] = useState(false);
  const [backCollapsed, setBackCollapsed] = useState(false);
  const [dropTargetRow, setDropTargetRow] = useState<number | null>(null);

  const setCell = (colIndex: number, value: string) => {
    setFactRow(
      row.map((e, i) => (i === colIndex ? { ...e, text: value } : e))
    );
  };
  const setTextLabel = (colIndex: number, value: string) => {
    setFactRow(
      row.map((e, i) => (i === colIndex ? { ...e, label: value } : e))
    );
  };
  const moveSlot = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...row];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setFactRow(next);
  };
  const addField = () => {
    const label = (deck.field ?? [])[row.length] ?? "";
    setFactRow([...row, { label, text: "", media: [] }]);
    setAddFactSplit((prev) => Math.min(prev, row.length + 1));
  };
  const removeCell = (colIndex: number) => {
    if (row.length <= 1) return;
    const next = row.filter((_, i) => i !== colIndex);
    setFactRow(next);
    setAddFactSplit((prev) => Math.min(prev, next.length <= 1 ? 1 : next.length));
  };

  const addMediaToRow = (rowIndex: number) => {
    setPendingMediaRowIndex(rowIndex);
    fileInputRef.current?.click();
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    const idx = pendingMediaRowIndex;
    setPendingMediaRowIndex(null);
    if (idx == null || idx < 0 || idx >= row.length) return;
    const valid = chosen.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("audio/")
    );
    const entry = row[idx];
    const toAdd = valid.slice(0, Math.max(0, MAX_MEDIA_PER_ENTRY - entry.media.length)).map((file) => ({ file }));
    if (toAdd.length === 0) return;
    setFactRow(
      row.map((e, i) => (i === idx ? { ...e, media: [...e.media, ...toAdd] } : e))
    );
  };

  const removeMediaFromRow = (rowIndex: number, mediaIndex: number) => {
    setFactRow(
      row.map((e, i) =>
        i === rowIndex ? { ...e, media: e.media.filter((_, j) => j !== mediaIndex) } : e
      )
    );
  };

  const fieldCount = row.length;
  const maxSplit = fieldCount <= 1 ? 1 : fieldCount;
  const split = Math.min(Math.max(1, addFactSplit), maxSplit);

  const renderEntryRow = (entry: AddFactEntry, colIndex: number, showDragHandle: boolean) => (
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
      className={`flex flex-col gap-1 rounded-md border p-1 -m-1 transition-colors group ${dropTargetRow === colIndex ? "border-transparent border-b-4 border-b-primary" : "border-transparent hover:border-input/50 bg-transparent hover:bg-muted/30"}`}
    >
      <div className="flex items-center gap-2 flex-nowrap">
        {showDragHandle ? (
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
        ) : (
          <span className="flex h-10 w-8 shrink-0" aria-hidden />
        )}
        {(deck.field ?? []).includes(entry.label) ? (
          <span className="flex h-10 w-20 shrink-0 items-center text-sm font-medium">
            {entry.label}
          </span>
        ) : (
          <Input
            aria-label="Field name"
            placeholder={`Field ${colIndex + 1}`}
            value={entry.label}
            onChange={(e) => setTextLabel(colIndex, e.target.value)}
            disabled={addingFacts}
            className="!w-20 !px-0 h-10 shrink-0 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none placeholder:text-foreground/50"
          />
        )}
        <Input
          id={`fact-0-${colIndex}`}
          placeholder="Value"
          value={entry.text}
          onChange={(e) => setCell(colIndex, e.target.value)}
          disabled={addingFacts}
          className="!w-auto min-w-0 flex-1"
        />
        <DropdownMenu trigger="…" align="end">
          <DropdownMenuItem
            onClick={() => addMediaToRow(colIndex)}
            disabled={addingFacts || entry.media.length >= MAX_MEDIA_PER_ENTRY}
          >
            Add media
          </DropdownMenuItem>
        </DropdownMenu>
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
      {entry.media.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pl-10">
          {entry.media.map((m, mi) => (
            <span
              key={mi}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
            >
              <span className="max-w-[120px] truncate">{m.file.name}</span>
              <button
                type="button"
                onClick={() => removeMediaFromRow(colIndex, mi)}
                disabled={addingFacts}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove media"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const formContent = (
    <form onSubmit={onSubmit} className="space-y-4">
      {addFactsError && <p className="text-sm text-destructive">{addFactsError}</p>}
      <div className="space-y-2">
        {fieldCount > 1 && split > 0 && (
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0 space-y-2">
              {!frontCollapsed &&
                row.slice(0, split).map((entry, i) => renderEntryRow(entry, i, true))}
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
            {row.map((entry, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 rounded-md border border-transparent hover:border-input/50 bg-transparent p-1 -m-1"
              >
                <div className="flex items-center gap-2 flex-nowrap">
                  <span className="flex h-10 w-8 shrink-0" aria-hidden />
                  <span className="flex h-10 w-20 shrink-0 items-center text-sm font-medium">
                    {entry.label}
                  </span>
                  <Input
                    id={`fact-0-${i}`}
                    placeholder="Value"
                    value={entry.text}
                    onChange={(e) => setCell(i, e.target.value)}
                    disabled={addingFacts}
                    className="!w-auto min-w-0 flex-1"
                  />
                  <DropdownMenu trigger="…" align="end">
                    <DropdownMenuItem
                      onClick={() => addMediaToRow(i)}
                      disabled={addingFacts || entry.media.length >= MAX_MEDIA_PER_ENTRY}
                    >
                      Add media
                    </DropdownMenuItem>
                  </DropdownMenu>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCell(i)}
                    disabled={addingFacts}
                    aria-label="Remove"
                  >
                    ×
                  </Button>
                </div>
                {entry.media.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pl-10">
                    {entry.media.map((m, mi) => (
                      <span
                        key={mi}
                        className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
                      >
                        <span className="max-w-[120px] truncate">{m.file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeMediaFromRow(i, mi)}
                          disabled={addingFacts}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove media"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
            aria-label="Drag cut line; drop on a field row to set how many fields are on front."
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
                row.slice(split).map((entry, i) => renderEntryRow(entry, split + i, true))}
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
          tabIndex={-1}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="op" className="sr-only">Operation</Label>
        <select
          id="op"
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={addingFacts}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={
            addingFacts ||
            !row.some((e) => e.text.trim() !== "" || e.media.length > 0)
          }
        >
          {addingFacts ? "Adding…" : "Add facts"}
        </Button>
      </div>
    </form>
  );

  if (onCancel) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter one fact. Add fields and media; drag the cut line to set front vs back.
        </p>
        {formContent}
      </div>
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
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
