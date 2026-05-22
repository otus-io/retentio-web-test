import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DeckUpdatesAlertBannerProps {
  updateCount: number;
  /** First deck id with an update (for quick navigation). */
  firstDeckId?: string;
  onDismiss?: () => void;
}

export function DeckUpdatesAlertBanner({
  updateCount,
  firstDeckId,
  onDismiss,
}: DeckUpdatesAlertBannerProps) {
  if (updateCount < 1) return null;

  const label =
    updateCount === 1
      ? "1 imported deck has an update from its author."
      : `${updateCount} imported decks have updates from their authors.`;

  return (
    <div
      className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      role="status"
    >
      <p className="text-sm">
        <span className="font-medium text-amber-900 dark:text-amber-100">Update available — </span>
        {label} Open the deck and choose <strong>Review update</strong> to see changes before accepting.
      </p>
      <div className="flex flex-wrap gap-2 shrink-0">
        {firstDeckId && (
          <Button size="sm" variant="default" asChild>
            <Link to={`/decks/${firstDeckId}`}>Review</Link>
          </Button>
        )}
        {onDismiss && (
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
