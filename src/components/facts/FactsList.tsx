import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { DeckItem, Entry, FactItem } from "@/lib/api";
import { entryToDisplayString } from "@/lib/api";

const DEFAULT_PAGE_SIZE = 5;

function getFieldLabel(deck: DeckItem, entryIndex: number): string {
  const fieldNames = deck.fields ?? [];
  if (entryIndex < fieldNames.length) return fieldNames[entryIndex];
  return "";
}

interface FactsListProps {
  deck: DeckItem;
  factsList: FactItem[];
  loadingFacts: boolean;
  factError: string;
  factSuccess: string;
  editingFactId: string | null;
  editingFactEntries: Entry[];
  editingFactSplit: number;
  setEditingFactId: (id: string | null) => void;
  setEditingFactEntries: (v: Entry[]) => void;
  setEditingFactSplit: (v: number) => void;
  setFactError: (v: string) => void;
  onUpdateFact: (e: React.FormEvent) => void;
  onDeleteFact: (factId: string) => void;
  deleteFactId: string | null;
  setDeleteFactId: (id: string | null) => void;
  /** Opens the Add facts form (e.g. in a modal). When provided, header shows a dropdown with "Add facts". */
  onOpenAddFacts?: () => void;
  /** When set, overrides `deck.stats.facts_count` for “shown of N” (from GET /facts `meta.total`). */
  factsTotal?: number | null;
}

export function FactsList({
  deck,
  factsList,
  loadingFacts,
  factError,
  factSuccess,
  editingFactId,
  editingFactEntries,
  editingFactSplit: _editingFactSplit,
  setEditingFactId,
  setEditingFactEntries,
  setEditingFactSplit,
  setFactError,
  onUpdateFact,
  onDeleteFact,
  deleteFactId,
  setDeleteFactId,
  onOpenAddFacts,
  factsTotal: factsTotalProp,
}: FactsListProps) {
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;

  const total = factsList.length;
  const totalInDeck =
    factsTotalProp != null && factsTotalProp >= 0 ? factsTotalProp : (deck.stats?.facts_count ?? total);
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
        <div className="flex items-center gap-2">
          {!loadingFacts && total > 0 && (
            <span className="text-sm text-muted-foreground">
              {total < totalInDeck
                ? `${total} shown of ${totalInDeck} fact${totalInDeck !== 1 ? "s" : ""}`
                : `${total} fact${total !== 1 ? "s" : ""}`}
            </span>
          )}
          {onOpenAddFacts && (
            <DropdownMenu
              trigger="⋮"
              align="end"
              className="shrink-0"
            >
              <DropdownMenuItem onClick={onOpenAddFacts}>
                Add facts
              </DropdownMenuItem>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {factError && <p className="text-sm text-destructive">{factError}</p>}
        {factSuccess && <p className="text-sm text-green-600">{factSuccess}</p>}
        {loadingFacts ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : factsList.length === 0 ? (
          <p className="text-muted-foreground">No facts yet. Use the menu above to add facts.</p>
        ) : (
          <>
            <ul className="divide-y rounded-md border">
              {paginatedFacts.map((f) => (
              <li key={f.id} className="px-3 py-2 first:pt-2 hover:bg-muted/50">
                {editingFactId === f.id ? (
                  <form onSubmit={onUpdateFact} className="w-full space-y-3">
                    {editingFactEntries.map((entry, i) => (
                      <div key={i} className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {getFieldLabel(deck, i)}
                        </Label>
                        <Input
                          value={entry.text ?? ""}
                          onChange={(e) => {
                            const next = editingFactEntries.map((ent, j) =>
                              j === i ? { ...ent, text: e.target.value } : ent
                            );
                            setEditingFactEntries(next);
                          }}
                        />
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button type="submit">Save</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingFactId(null);
                          setEditingFactEntries([]);
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
                      {f.entries.map(entryToDisplayString).join(" · ")}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingFactId(f.id);
                          setEditingFactEntries(f.entries.map((e) => ({ ...e })));
                          setEditingFactSplit(1);
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
          return <>Are you sure you want to delete this fact{fact ? <> (&quot;{fact.entries.map(entryToDisplayString).join(" · ")}&quot;)</> : null}? This cannot be undone.</>;
        })()}
      </Dialog>
    </Card>
  );
}
