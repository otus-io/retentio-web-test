import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DeckItem, FactItem } from "@/lib/api";

interface FactsListProps {
  deck: DeckItem;
  factsList: FactItem[];
  loadingFacts: boolean;
  factError: string;
  factSuccess: string;
  editingFactId: string | null;
  editingFactFields: string;
  setEditingFactId: (id: string | null) => void;
  setEditingFactFields: (v: string) => void;
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
  editingFactFields,
  setEditingFactId,
  setEditingFactFields,
  setFactError,
  onUpdateFact,
  onDeleteFact,
  deleteFactId,
  setDeleteFactId,
}: FactsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Facts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {factError && <p className="text-sm text-destructive">{factError}</p>}
        {factSuccess && <p className="text-sm text-green-600">{factSuccess}</p>}
        {loadingFacts ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : factsList.length === 0 ? (
          <p className="text-muted-foreground">No facts yet. Add some above.</p>
        ) : (
          <ul className="divide-y">
            {factsList.map((f) => (
              <li key={f.id} className="py-2 first:pt-0">
                {editingFactId === f.id ? (
                  <form onSubmit={onUpdateFact} className="space-y-2">
                    <Input
                      value={editingFactFields}
                      onChange={(e) => setEditingFactFields(e.target.value)}
                      placeholder={deck.field.join(", ")}
                    />
                    <div className="flex gap-2">
                      <Button type="submit">Save</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingFactId(null);
                          setFactError("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">{f.fields.join(" · ")}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingFactId(f.id);
                          setEditingFactFields(f.fields.join(", "));
                          setFactError("");
                        }}
                      >
                        Edit
                      </Button>
                      {deleteFactId === f.id ? (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDeleteFact(f.id)}
                          >
                            Confirm
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteFactId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteFactId(f.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
