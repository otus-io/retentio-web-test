import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
    <Card className="relative">
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu align="end">
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDeleteConfirm}>
            Delete deck
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
      <Dialog
        open={deleteConfirm}
        onOpenChange={(open) => !open && onDeleteCancel()}
        title="Delete deck?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={onDelete}
      >
        Are you sure you want to delete &quot;{deck.name}&quot;? This cannot be undone.
      </Dialog>
      <CardHeader className="pb-2 text-center">
        <CardTitle>{deck.name}</CardTitle>
        <p className="text-xs text-muted-foreground font-mono">ID: {deck.id}</p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Fields</dt>
            <dd className="mt-0.5">{deck.field.join(", ")}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Rate</dt>
            <dd className="mt-0.5">{deck.rate}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Sibling</dt>
            <dd className="mt-0.5">{deck.templates.length === 2 ? "Yes" : "No"}</dd>
          </div>
        </dl>
        <div className="border-t pt-4 space-y-2">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Stats</p>
          <ul className="text-sm space-y-1.5 list-none">
            <li><span className="text-muted-foreground">Facts:</span> {deck.stats.facts_count}</li>
            <li><span className="text-muted-foreground">Cards:</span> {deck.stats.cards_count}</li>
            <li><span className="text-muted-foreground">Unseen:</span> {deck.stats.unseen_cards}</li>
            <li><span className="text-muted-foreground">Reviewed:</span> {deck.stats.reviewed_cards}</li>
            <li><span className="text-muted-foreground">Due:</span> {deck.stats.due_cards}</li>
            <li><span className="text-muted-foreground">Hidden:</span> {deck.stats.hidden_cards}</li>
            <li><span className="text-muted-foreground">New today:</span> {deck.stats.new_cards_today}</li>
            {deck.stats.last_reviewed_at != null && deck.stats.last_reviewed_at > 0 && (
              <li><span className="text-muted-foreground">Last review:</span> {formatLastReview(deck.stats.last_reviewed_at)}</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
