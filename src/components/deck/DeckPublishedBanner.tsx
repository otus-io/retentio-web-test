import type { DeckItem } from "@/lib/api";

interface DeckPublishedBannerProps {
  deck: DeckItem;
}

export function DeckPublishedBanner({ deck }: DeckPublishedBannerProps) {
  const version = deck.published_version ?? 0;
  if (version <= 0) return null;

  return (
    <div
      className="rounded-lg border border-green-600/40 bg-green-600/10 px-4 py-3 text-sm"
      role="status"
      aria-label={`Published deck version ${version}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-green-700 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-green-600">
          Published
        </span>
        <span className="font-medium">v{version}</span>
        {deck.visibility === "public" && (
          <span className="text-muted-foreground">· Public · importable by deck ID</span>
        )}
      </div>
      <p className="mt-1.5 text-muted-foreground">
        Share <span className="font-mono text-foreground">{deck.id}</span> so others can import this
        deck. Published decks cannot be deleted.
      </p>
    </div>
  );
}
