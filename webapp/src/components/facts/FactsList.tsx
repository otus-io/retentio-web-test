import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { DeckItem, FactItem } from "@/lib/api";
import { formatMediaMarkersForDisplay } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 5;

function getFieldLabel(deck: DeckItem, entryIndex: number, entriesLength: number): string {
  const fieldNames = deck.field ?? [];
  if (entryIndex < fieldNames.length) return fieldNames[entryIndex];
  const extra = entriesLength - fieldNames.length;
  if (extra === 2 && entryIndex === fieldNames.length) return "Audio";
  if (extra === 2 && entryIndex === fieldNames.length + 1) return "Image";
  if (extra === 1 && entryIndex === fieldNames.length) return "Audio";
  return `Field ${entryIndex + 1}`;
}

interface FactsListProps {
  deck: DeckItem;
  factsList: FactItem[];
  loadingFacts: boolean;
  factError: string;
  factSuccess: string;
  editingFactId: string | null;
  editingFactValues: string[];
  editingFactSplit: number;
  editingFactSibling: boolean;
  setEditingFactId: (id: string | null) => void;
  setEditingFactValues: (v: string[]) => void;
  setEditingFactSplit: (v: number) => void;
  setEditingFactSibling: (v: boolean) => void;
  setFactError: (v: string) => void;
  onUpdateFact: (e: React.FormEvent) => void;
  onDeleteFact: (factId: string) => void;
  deleteFactId: string | null;
  setDeleteFactId: (id: string | null) => void;
}

export function FactsList({
  deck,
  factsList,
  loadingFacts,
  factError,
  factSuccess,
  editingFactId,
  editingFactValues,
  editingFactSplit,
  editingFactSibling,
  setEditingFactId,
  setEditingFactValues,
  setEditingFactSplit,
  setEditingFactSibling,
  setFactError,
  onUpdateFact,
  onDeleteFact,
  deleteFactId,
  setDeleteFactId,
}: FactsListProps) {
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;

  const total = factsList.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const paginatedFacts = factsList.slice(start, start + pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Facts</CardTitle>
        {!loadingFacts && total > 0 && (
          <span className="text-sm text-muted-foreground">
            {total} fact{total !== 1 ? "s" : ""}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {factError && <p className="text-sm text-destructive">{factError}</p>}
        {factSuccess && <p className="text-sm text-green-600">{factSuccess}</p>}
        {loadingFacts ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : factsList.length === 0 ? (
          <p className="text-muted-foreground">No facts yet. Add some above.</p>
        ) : (
          <>
            <ul className="divide-y rounded-md border">
              {paginatedFacts.map((f) => (
              <li key={f.id} className="px-3 py-2 first:pt-2 hover:bg-muted/50">
                {editingFactId === f.id ? (
                  <form onSubmit={onUpdateFact} className="w-full space-y-3">
                    {editingFactValues.map((_, i) => (
                      <div key={i} className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {getFieldLabel(deck, i, editingFactValues.length)}
                        </Label>
                        <Input
                          value={editingFactValues[i] ?? ""}
                          onChange={(e) => {
                            const next = [...editingFactValues];
                            next[i] = e.target.value;
                            setEditingFactValues(next);
                          }}
                        />
                      </div>
                    ))}
                    {editingFactValues.length > 1 && (
                      <div className="space-y-1">
                        <Label htmlFor={`fact-split-${f.id}`} className="text-xs font-medium text-muted-foreground">
                          Split (fields on front)
                        </Label>
                        <select
                          id={`fact-split-${f.id}`}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={editingFactSplit}
                          onChange={(e) => setEditingFactSplit(parseInt(e.target.value, 10) || 1)}
                        >
                          {Array.from({ length: editingFactValues.length }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        id={`fact-sibling-${f.id}`}
                        type="checkbox"
                        checked={editingFactSibling}
                        onChange={(e) => setEditingFactSibling(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <Label htmlFor={`fact-sibling-${f.id}`} className="font-normal cursor-pointer text-sm">
                        Sibling
                      </Label>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">Save</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingFactId(null);
                          setEditingFactValues([]);
                          setFactError("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm min-w-0 flex-1">
                      {f.entries.map(formatMediaMarkersForDisplay).join(" · ")}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingFactId(f.id);
                          setEditingFactValues([...f.entries]);
                          setEditingFactSplit(1);
                          setEditingFactSibling(false);
                          setFactError("");
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteFactId(f.id)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenu>
                  </div>
                )}
              </li>
            ))}
            </ul>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  Showing {start + 1}–{Math.min(start + pageSize, total)} of {total}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <span className="px-2 text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      <Dialog
        open={deleteFactId !== null}
        onOpenChange={(open) => !open && setDeleteFactId(null)}
        title="Delete fact?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => deleteFactId && onDeleteFact(deleteFactId)}
      >
        {deleteFactId && (() => {
          const fact = factsList.find((x) => x.id === deleteFactId);
          return <>Are you sure you want to delete this fact{fact ? <> (&quot;{fact.entries.map(formatMediaMarkersForDisplay).join(" · ")}&quot;)</> : null}? This cannot be undone.</>;
        })()}
      </Dialog>
    </Card>
  );
}
