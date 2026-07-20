import { Button } from "@/components/ui/button";
import type { DeckItem } from "@/lib/api";
import { deckDisplayOwner } from "@/lib/api";

interface DeckProvenanceBannerProps {
  deck: DeckItem;
  updateAvailable: boolean;
  onReviewUpdate: () => void;
}

export function DeckProvenanceBanner({
  deck,
  updateAvailable,
  onReviewUpdate,
}: DeckProvenanceBannerProps) {
  if (!deck.source_deck_id) return null;

  return (
    <div
      className={
        updateAvailable
          ? "rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          : "rounded-lg border bg-muted/40 px-4 py-3 text-sm"
      }
    >
      <div className="text-sm space-y-1">
        {updateAvailable && (
          <p className="font-medium text-amber-900 dark:text-amber-100">Update available</p>
        )}
        <p>
          <span className="text-muted-foreground">Imported from </span>
          <span className="font-mono">{deck.source_deck_id}</span>
          {deckDisplayOwner(deck) !== "—" && (
            <>
              <span className="text-muted-foreground"> by </span>
              <span className="font-medium">{deckDisplayOwner(deck)}</span>
            </>
          )}
          <span className="text-muted-foreground"> · pinned to </span>
          <span className="font-medium">v{deck.source_version ?? "?"}</span>
          <span className="text-muted-foreground"> · local edits stay private until you contribute</span>
        </p>
      </div>
      {updateAvailable && (
        <Button size="sm" variant="default" onClick={onReviewUpdate}>
          Review update
        </Button>
      )}
    </div>
  );
}
