import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  isImportedDeck,
  isPublishedSourceDeck,
  type DeckItem,
} from "@/lib/api";
import { getDeckTags, type TagItem } from "@/lib/tags";

function formatDeckTimestamp(value: string | undefined): string {
  if (!value?.trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatVisibilityLabel(visibility: string | undefined, imported: boolean): string {
  if (imported) return "Imported copy";
  const v = (visibility?.trim() || "private").toLowerCase();
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function formatPublishedLabel(deck: DeckItem, imported: boolean): string {
  if (imported) {
    const v = deck.source_version;
    return v != null && v > 0 ? `Pinned to source v${v}` : "—";
  }
  const v = deck.published_version ?? 0;
  return v > 0 ? `v${v}` : "Not published";
}

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
  return d.toLocaleDateString(undefined, {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface DeckInfoCardProps {
  deck: DeckItem;
  /** When set, loads and shows deck tags from GET /api/decks/{id}/tags. */
  token?: string | null;
  /** Bump to refetch tags after edit (e.g. deck page). */
  tagsRefreshKey?: number;
  onEdit: () => void;
  onBulkEditFacts: () => void;
  /** Opens font settings for study cards (main + ruby, front + back). */
  onOpenCardFonts?: () => void;
  /** Opens the add-facts flow (e.g. modal on the deck page). */
  onOpenAddFacts?: () => void;
  /** Opens full card list (filter by unseen / overdue / seen / hidden). */
  onOpenAllCards?: () => void;
  /** Opens publish dialog (source decks only). */
  onPublish?: () => void;
  deleteConfirm: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onDelete: () => void;
  /** When false, hide fact-editing menu items (imported decks). */
  factsEditable?: boolean;
}

export function DeckInfoCard({
  deck,
  token,
  tagsRefreshKey = 0,
  onEdit,
  onBulkEditFacts,
  onOpenCardFonts,
  onOpenAddFacts,
  onOpenAllCards,
  onPublish,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
  onDelete,
  factsEditable = true,
}: DeckInfoCardProps) {
  const imported = isImportedDeck(deck);
  const published = isPublishedSourceDeck(deck);
  const [copied, setCopied] = useState(false);
  const [deckTags, setDeckTags] = useState<TagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  useEffect(() => {
    if (!token?.trim()) {
      setDeckTags([]);
      return;
    }
    let cancelled = false;
    setTagsLoading(true);
    void getDeckTags(deck.id, token)
      .then((res) => {
        if (!cancelled) setDeckTags(Array.isArray(res.data.tags) ? res.data.tags : []);
      })
      .catch(() => {
        if (!cancelled) setDeckTags([]);
      })
      .finally(() => {
        if (!cancelled) setTagsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deck.id, token, tagsRefreshKey]);

  async function copyDeckId() {
    try {
      await navigator.clipboard.writeText(deck.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="relative">
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu align="end">
          <DropdownMenuItem onClick={onEdit}>Edit Deck</DropdownMenuItem>
          {onPublish && !imported && (
            <DropdownMenuItem onClick={onPublish}>
              {published ? "Publish update" : "Publish for sharing"}
            </DropdownMenuItem>
          )}
          {onOpenCardFonts && (
            <DropdownMenuItem onClick={onOpenCardFonts}>Change Font</DropdownMenuItem>
          )}
          {factsEditable && onOpenAddFacts && (
            <DropdownMenuItem onClick={onOpenAddFacts}>Add Facts</DropdownMenuItem>
          )}
          {onOpenAllCards && (
            <DropdownMenuItem onClick={onOpenAllCards}>Get All Cards</DropdownMenuItem>
          )}
          {factsEditable && (
            <DropdownMenuItem onClick={onBulkEditFacts}>Edit Facts</DropdownMenuItem>
          )}
          {!published && (
            <DropdownMenuItem variant="destructive" onClick={onDeleteConfirm}>
              Delete deck
            </DropdownMenuItem>
          )}
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
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {imported && (
            <span className="text-xs rounded-full bg-muted px-2 py-0.5">Imported</span>
          )}
          {!imported && deck.visibility === "public" && (
            <span className="text-xs rounded-full bg-green-600/15 text-green-800 dark:text-green-300 px-2 py-0.5">
              Public
            </span>
          )}
          {!imported && published && (
            <span className="text-xs rounded-full bg-green-600/15 text-green-800 dark:text-green-300 px-2 py-0.5 font-medium">
              Published · v{deck.published_version}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono mt-1">ID: {deck.id}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs mt-1"
          onClick={() => void copyDeckId()}
        >
          {copied ? "Copied!" : "Copy deck ID"}
        </Button>
        {published && !imported && (
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Published decks cannot be deleted. Share this ID so others can import.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Fields</dt>
            <dd className="mt-0.5">{deck.fields.join(", ")}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Rate</dt>
            <dd className="mt-0.5">{deck.rate}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Sibling</dt>
            <dd className="mt-0.5">Per fact</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Tags</dt>
            <dd className="mt-0.5">
              {tagsLoading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : (deckTags?.length ?? 0) === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <ul className="flex flex-wrap gap-1.5 list-none">
                  {[...(deckTags ?? [])]
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
                    .map((t) => (
                      <li
                        key={t.id}
                        className="inline-flex rounded-full border bg-muted/50 px-2.5 py-0.5 text-sm"
                        title={t.description || undefined}
                      >
                        {t.name}
                      </li>
                    ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
        <div className="border-t pt-4 space-y-2">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Deck info</p>
          <ul className="text-sm space-y-1.5 list-none">
            <li>
              <span className="text-muted-foreground">Visibility:</span>{" "}
              {formatVisibilityLabel(deck.visibility, imported)}
            </li>
            <li>
              <span className="text-muted-foreground">
                {imported ? "Source version:" : "Published:"}
              </span>{" "}
              {formatPublishedLabel(deck, imported)}
            </li>
            <li>
              <span className="text-muted-foreground">Owner:</span> {deck.owner || "—"}
            </li>
            <li>
              <span className="text-muted-foreground">Created:</span>{" "}
              {formatDeckTimestamp(deck.created_at)}
            </li>
            <li>
              <span className="text-muted-foreground">Updated:</span>{" "}
              {formatDeckTimestamp(deck.updated_at)}
            </li>
            {imported && deck.source_deck_id && (
              <li>
                <span className="text-muted-foreground">Source deck:</span>{" "}
                <span className="font-mono text-xs">{deck.source_deck_id}</span>
              </li>
            )}
            {imported && deck.imported_at && (
              <li>
                <span className="text-muted-foreground">Imported:</span>{" "}
                {formatDeckTimestamp(deck.imported_at)}
              </li>
            )}
          </ul>
        </div>
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
