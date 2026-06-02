import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { catalogHasMore, listCatalogDecks, type CatalogDeckItem } from "@/lib/api";
import { formatCatalogPublishedAt } from "@/lib/catalog";

const PAGE_SIZE = 12;

interface DeckCatalogPanelProps {
  token?: string | null;
}

export function DeckCatalogPanel({ token }: DeckCatalogPanelProps) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [decks, setDecks] = useState<CatalogDeckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError("");
      try {
        const res = await listCatalogDecks(
          { query: query || undefined, limit: PAGE_SIZE, offset },
          token
        );
        const rows = res.data.decks ?? [];
        setDecks((prev) => (append ? [...prev, ...rows] : rows));
        setHasMore(catalogHasMore(res.meta));
      } catch (err) {
        if (!append) setDecks([]);
        setHasMore(false);
        setError(err instanceof Error ? err.message : "Could not load catalog");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, token]
  );

  useEffect(() => {
    void fetchPage(0, false);
  }, [fetchPage]);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  return (
    <Card id="catalog">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">Shared deck catalog</CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Browse published decks from the community. Open a deck for details and import.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, author, or tag…"
          aria-label="Search catalog"
        />

        {loading && decks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading catalog…</p>
        ) : error && decks.length === 0 ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : decks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published decks match your search.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {decks.map((deck) => (
              <li key={deck.id}>
                <Link
                  to={`/catalog/${deck.id}`}
                  state={{ deck }}
                  className="block rounded-lg border border-border p-3 space-y-2 h-full transition-colors hover:bg-muted/50 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div>
                    <p className="font-medium leading-snug">{deck.name}</p>
                    <p className="text-xs text-muted-foreground">
                      by {deck.owner} · {deck.fact_count} facts
                    </p>
                  </div>
                  {deck.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                      {deck.description}
                    </p>
                  ) : null}
                  {deck.deck_tag_names && deck.deck_tag_names.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {deck.deck_tag_names.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                      {deck.deck_tag_names.length > 4 ? (
                        <span className="text-xs text-muted-foreground">
                          +{deck.deck_tag_names.length - 4} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Published {formatCatalogPublishedAt(deck.published_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => void fetchPage(decks.length, true)}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
