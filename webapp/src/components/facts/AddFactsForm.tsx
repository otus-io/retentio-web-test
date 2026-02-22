import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { DeckItem } from "@/lib/api";
import type { AddFactOperation } from "@/lib/api";

interface AddFactsFormProps {
  deck: DeckItem;
  factsInput: string;
  setFactsInput: (v: string) => void;
  addFactOp: AddFactOperation;
  setAddFactOp: (v: AddFactOperation) => void;
  addingFacts: boolean;
  addFactsError: string;
  onSubmit: (e: React.FormEvent) => void;
}

export function AddFactsForm({
  deck,
  factsInput,
  setFactsInput,
  addFactOp,
  setAddFactOp,
  addingFacts,
  addFactsError,
  onSubmit,
}: AddFactsFormProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Add facts</CardTitle>
        <p className="text-sm font-normal text-muted-foreground">
          One fact per line. Separate values by comma or tab. This deck has {deck.field.length}{" "}
          fields: {deck.field.join(", ")}.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          {addFactsError && <p className="text-sm text-destructive">{addFactsError}</p>}
          <div className="space-y-2">
            <Label htmlFor="facts">Facts</Label>
            <textarea
              id="facts"
              rows={5}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={"Apple, 苹果\nBanana, 香蕉"}
              value={factsInput}
              onChange={(e) => setFactsInput(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op">Operation</Label>
            <select
              id="op"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={addFactOp}
              onChange={(e) => setAddFactOp(e.target.value as AddFactOperation)}
            >
              <option value="append">Append</option>
              <option value="prepend">Prepend</option>
              <option value="shuffle">Shuffle</option>
              <option value="spread">Spread</option>
            </select>
          </div>
          <Button type="submit" disabled={addingFacts}>
            {addingFacts ? "Adding…" : "Add facts"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
