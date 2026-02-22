import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DeckItem } from "@/lib/api";

interface DeckInfoCardProps {
  deck: DeckItem;
  onEdit: () => void;
  deleteConfirm: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onDelete: () => void;
}

export function DeckInfoCard({
  deck,
  onEdit,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
  onDelete,
}: DeckInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{deck.name}</CardTitle>
        <p className="text-sm text-muted-foreground">ID: {deck.id}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="font-medium text-muted-foreground">Fields</dt>
            <dd>{deck.field.join(", ")}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Rate</dt>
            <dd>{deck.rate}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Sibling</dt>
            <dd>{deck.templates.length === 2 ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Stats</dt>
            <dd>
              {deck.stats.facts_count} facts · {deck.stats.cards_count} cards ·{" "}
              {deck.stats.due_cards} due
            </dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <Button onClick={onEdit}>Edit</Button>
          {deleteConfirm ? (
            <>
              <Button variant="destructive" onClick={onDelete}>
                Confirm delete
              </Button>
              <Button variant="outline" onClick={onDeleteCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="destructive" onClick={onDeleteConfirm}>
              Delete deck
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
