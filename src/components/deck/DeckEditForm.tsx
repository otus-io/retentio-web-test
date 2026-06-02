import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DeckTagsPicker } from "@/components/deck/DeckTagsPicker";

interface DeckEditFormProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  fieldNames: string[];
  setFieldNames: (v: string[]) => void;
  rate: number;
  setRate: (v: number) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  /** Imported decks: fields are locked to the snapshot schema. */
  fieldsLocked?: boolean;
  token?: string | null;
  deckId?: string;
  tagIds?: string[];
  onTagIdsChange?: (ids: string[]) => void;
}

export function DeckEditForm({
  name,
  setName,
  description,
  setDescription,
  fieldNames,
  setFieldNames,
  rate,
  setRate,
  saving,
  onSubmit,
  onCancel,
  fieldsLocked = false,
  token,
  deckId,
  tagIds = [],
  onTagIdsChange,
}: DeckEditFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit deck</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Optional deck description"
              disabled={fieldsLocked}
            />
            <p className="text-xs text-muted-foreground">Up to 500 characters.</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Fields</p>
            {fieldsLocked ? (
              <p className="text-sm text-muted-foreground">{fieldNames.filter(Boolean).join(", ")}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">One box per column (at least 1).</p>
                {fieldNames.map((value, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Label htmlFor={`edit-field-${i}`} className="sr-only">Field {i + 1}</Label>
                    <Input
                      id={`edit-field-${i}`}
                      value={value}
                      onChange={(e) => {
                        const next = [...fieldNames];
                        next[i] = e.target.value;
                        setFieldNames(next);
                      }}
                      placeholder={`Field ${i + 1}`}
                    />
                    {fieldNames.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive shrink-0"
                        onClick={() => setFieldNames(fieldNames.filter((_, j) => j !== i))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setFieldNames([...fieldNames, ""])}>
                  Add field
                </Button>
              </>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate">Rate (1–1000)</Label>
            <Input
              id="rate"
              type="number"
              min={1}
              max={1000}
              value={rate}
              onChange={(e) => setRate(parseInt(e.target.value, 10) || 20)}
            />
          </div>
          {token && deckId && onTagIdsChange && (
            <DeckTagsPicker
              token={token}
              deckId={deckId}
              selectedIds={tagIds}
              onSelectedIdsChange={onTagIdsChange}
              disabled={saving}
            />
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
