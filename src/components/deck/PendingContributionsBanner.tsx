import { Button } from "@/components/ui/button";

interface PendingContributionsBannerProps {
  pendingCount: number;
  onOpen: () => void;
}

/** Always-visible entry point to the importer contributions box. */
export function PendingContributionsBanner({
  pendingCount,
  onOpen,
}: PendingContributionsBannerProps) {
  const label =
    pendingCount < 1
      ? "Open to review pending and sent contributions."
      : pendingCount === 1
        ? "1 private change is waiting to send to the author."
        : `${pendingCount} private changes are waiting to send to the author.`;

  return (
    <div
      className={
        pendingCount > 0
          ? "rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          : "rounded-lg border bg-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      }
      role="status"
    >
      <p className="text-sm">
        <span className="font-medium">Contributions — </span>
        {label}
      </p>
      <Button size="sm" variant={pendingCount > 0 ? "default" : "outline"} onClick={onOpen}>
        Open contributions
      </Button>
    </div>
  );
}
