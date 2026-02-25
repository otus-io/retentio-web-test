import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DeckItem } from "@/lib/api";
import type { AddFactOperation } from "@/lib/api";

export type FactMediaEntry = { file: File; type: "image" | "audio" };

function getMediaType(file: File): "image" | "audio" {
  return file.type.startsWith("image/") ? "image" : "audio";
}

interface AddFactsFormProps {
  deck: DeckItem;
  factsRows: string[][];
  setFactsRows: (v: string[][]) => void;
  addFactOp: AddFactOperation;
  setAddFactOp: (v: AddFactOperation) => void;
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
  addingFacts,
  addFactsError,
  onSubmit,
  mediaFiles,
  setMediaFiles,
}: AddFactsFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const row = factsRows[0] ?? deck.field.map(() => "");
  const setCell = (colIndex: number, value: string) => {
    const next = [...row];
    next[colIndex] = value;
    setFactsRows([next]);
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
          Enter one fact. Each field has its own box.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {addFactsError && <p className="text-sm text-destructive">{addFactsError}</p>}
          <div className="space-y-2">
            {deck.field.map((fieldName, colIndex) => (
              <div key={colIndex} className="space-y-1">
                <Label htmlFor={`fact-0-${colIndex}`}>{fieldName}</Label>
                <Input
                  id={`fact-0-${colIndex}`}
                  value={row[colIndex] ?? ""}
                  onChange={(e) => setCell(colIndex, e.target.value)}
                  disabled={addingFacts}
                />
              </div>
            ))}
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
            <Button type="submit" disabled={addingFacts || row.every((s) => !s.trim())}>
              {addingFacts ? "Adding…" : "Add facts"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
