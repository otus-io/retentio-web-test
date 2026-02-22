import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DeckItem } from "@/lib/api";

function formatLastReview(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return "just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

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
            <dd className="space-y-1">
              <span className="block">
                {deck.stats.facts_count} facts · {deck.stats.cards_count} cards
              </span>
              <span className="block text-muted-foreground">
                {deck.stats.unseen_cards} unseen · {deck.stats.reviewed_cards} reviewed ·{" "}
                {deck.stats.due_cards} due · {deck.stats.hidden_cards} hidden
              </span>
              <span className="block text-muted-foreground">
                {deck.stats.new_cards_today} new today
                {deck.stats.last_reviewed_at != null && deck.stats.last_reviewed_at > 0
                  ? ` · Last review ${formatLastReview(deck.stats.last_reviewed_at)}`
                  : ""}
              </span>
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
