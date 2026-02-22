import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DeckItem } from "@/lib/api";
import type { AddFactOperation } from "@/lib/api";

interface AddFactsFormProps {
  deck: DeckItem;
  factsRows: string[][];
  setFactsRows: (v: string[][]) => void;
  addFactOp: AddFactOperation;
  setAddFactOp: (v: AddFactOperation) => void;
  addingFacts: boolean;
  addFactsError: string;
  onSubmit: (e: React.FormEvent) => void;
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
}: AddFactsFormProps) {
  const row = factsRows[0] ?? deck.field.map(() => "");
  const setCell = (colIndex: number, value: string) => {
    const next = [...row];
    next[colIndex] = value;
    setFactsRows([next]);
  };

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
