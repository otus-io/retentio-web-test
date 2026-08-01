import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { request, type DeckItem, type GetDecksRes } from "@/lib/api";
import {
  CONFIDENCE_PAGE_SIZE,
  fetchDeckFactConfidencesPage,
  formatPGood,
  type FactConfidenceRow,
} from "@/lib/confidence";

export default function ConfidencePage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<DeckItem[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [deckId, setDeckId] = useState("");
  const [rows, setRows] = useState<FactConfidenceRow[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const sortedDecks = useMemo(
    () => [...decks].sort((a, b) => a.name.localeCompare(b.name)),
    [decks]
  );

  const selectedDeck = useMemo(
    () => sortedDecks.find((d) => d.id === deckId) ?? null,
    [sortedDecks, deckId]
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoadingDecks(true);
    void request<GetDecksRes>("/api/decks", { token })
      .then((res) => {
        if (cancelled) return;
        const list = res.data.decks ?? [];
        setDecks(list);
        setDeckId((prev) => {
          if (prev && list.some((d) => d.id === prev)) return prev;
          return list[0]?.id ?? "";
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setDecks([]);
          setDeckId("");
          setError(e instanceof Error ? e.message : "Failed to load decks");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDecks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const loadFirstPage = useCallback(async () => {
    if (!token || !deckId) {
      setRows([]);
      setNextOffset(0);
      setHasMore(false);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError("");
    setRows([]);
    setNextOffset(0);
    setHasMore(false);
    setTotal(0);
    try {
      const page = await fetchDeckFactConfidencesPage(deckId, token, {
        limit: CONFIDENCE_PAGE_SIZE,
        offset: 0,
      });
      setRows(page.rows);
      setNextOffset(page.nextOffset);
      setHasMore(page.hasMore);
      setTotal(page.total);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load confidence");
    } finally {
      setLoading(false);
    }
  }, [token, deckId]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  async function handleLoadMore() {
    if (!token || !deckId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = await fetchDeckFactConfidencesPage(deckId, token, {
        limit: CONFIDENCE_PAGE_SIZE,
        offset: nextOffset,
      });
      setRows((prev) => [...prev, ...page.rows]);
      setNextOffset(page.nextOffset);
      setHasMore(page.hasMore);
      setTotal(page.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Confidence</h1>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/decks">Deck</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/tags">Tags</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/media">Media</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/quality">Quality</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/confidence">Confidence</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/profile">Profile</Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fact confidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 max-w-md">
              <Label htmlFor="confidence-deck">Deck</Label>
              {loadingDecks ? (
                <p className="text-sm text-muted-foreground">Loading decks…</p>
              ) : sortedDecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No decks yet.</p>
              ) : (
                <select
                  id="confidence-deck"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={deckId}
                  onChange={(e) => setDeckId(e.target.value)}
                >
                  {sortedDecks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Community confidence per fact: review <span className="font-medium">score</span>,{" "}
              <span className="font-medium">reports</span>, and derived{" "}
              <span className="font-medium">p_good</span>. Loads {CONFIDENCE_PAGE_SIZE} at a time;
              weakest <span className="font-medium">p_good</span> first deck-wide.
              {selectedDeck ? (
                <>
                  {" "}
                  Open{" "}
                  <Link
                    to={`/decks/${selectedDeck.id}`}
                    className="text-primary underline underline-offset-2"
                  >
                    {selectedDeck.name}
                  </Link>
                  .
                </>
              ) : null}
            </p>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!deckId || loadingDecks ? null : loading ? (
              <p className="text-muted-foreground">Loading confidence…</p>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground">No facts in this deck.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Showing {rows.length}
                  {total > 0 ? ` of ${total}` : ""} facts
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-3 py-2 font-medium">Fact</th>
                        <th className="px-3 py-2 font-medium tabular-nums">Score</th>
                        <th className="px-3 py-2 font-medium tabular-nums">Reports</th>
                        <th className="px-3 py-2 font-medium tabular-nums">p_good</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.fact.id} className="border-b last:border-0">
                          <td className="px-3 py-2 align-top">
                            <p className="whitespace-pre-wrap break-words max-w-md">{row.preview}</p>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                              {row.fact.id}
                            </p>
                          </td>
                          <td className="px-3 py-2 align-top tabular-nums">
                            {row.confidence.score}
                          </td>
                          <td className="px-3 py-2 align-top tabular-nums">
                            {row.confidence.reports}
                          </td>
                          <td className="px-3 py-2 align-top tabular-nums">
                            {formatPGood(row.confidence.p_good)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasMore && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loadingMore}
                    onClick={() => void handleLoadMore()}
                  >
                    {loadingMore ? "Loading…" : `Load more (${CONFIDENCE_PAGE_SIZE})`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
