import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DeckFeedbackAlertBannerProps {
  totalOpenCount: number;
  feedbackDeckCount: number;
  firstDeckId?: string;
  onDismiss?: () => void;
}

export function DeckFeedbackAlertBanner({
  totalOpenCount,
  feedbackDeckCount,
  firstDeckId,
  onDismiss,
}: DeckFeedbackAlertBannerProps) {
  if (totalOpenCount < 1) return null;

  const label =
    totalOpenCount === 1
      ? "1 open contribution on your published deck."
      : `${totalOpenCount} open contributions across ${feedbackDeckCount} published deck${feedbackDeckCount !== 1 ? "s" : ""}.`;

  return (
    <div
      className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      role="status"
    >
      <p className="text-sm">
        <span className="font-medium text-blue-900 dark:text-blue-100">Contributions waiting — </span>
        {label} Open the deck and choose <strong>Contributions inbox</strong> to review.
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

interface DeckOpenFeedbackBannerProps {
  openCount: number;
  onOpenInbox: () => void;
}

export function DeckOpenFeedbackBanner({ openCount, onOpenInbox }: DeckOpenFeedbackBannerProps) {
  if (openCount < 1) return null;

  const label =
    openCount === 1
      ? "1 open contribution from an importer."
      : `${openCount} open contributions from importers.`;

  return (
    <div
      className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      role="status"
    >
      <p className="text-sm">
        <span className="font-medium text-blue-900 dark:text-blue-100">Contributions waiting — </span>
        {label}
      </p>
      <Button size="sm" variant="default" onClick={onOpenInbox}>
        Open contributions inbox
      </Button>
    </div>
  );
}
