import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Page numbers around `current`, always including first and last, with gaps. */
function confidencePageItems(current: number, totalPages: number): Array<number | "gap"> {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("gap");
    out.push(n);
  }
  return out;
}

export default function ConfidencePage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<DeckItem[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [deckId, setDeckId] = useState("");
  const [rows, setRows] = useState<FactConfidenceRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loadGenRef = useRef(0);

  const sortedDecks = useMemo(
    () => [...decks].sort((a, b) => a.name.localeCompare(b.name)),
    [decks]
  );

  const selectedDeck = useMemo(
    () => sortedDecks.find((d) => d.id === deckId) ?? null,
    [sortedDecks, deckId]
  );

  const totalPages = Math.max(1, Math.ceil(total / CONFIDENCE_PAGE_SIZE));
  const pageItems = useMemo(
    () => confidencePageItems(page, total > 0 ? totalPages : 1),
    [page, total, totalPages]
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

  const loadPage = useCallback(
    async (pageNum: number) => {
      if (!token || !deckId) {
        setRows([]);
        setPage(1);
        setTotal(0);
        return;
      }
      const safePage = Math.max(1, pageNum);
      const gen = ++loadGenRef.current;
      setLoading(true);
      setError("");
      try {
        const offset = (safePage - 1) * CONFIDENCE_PAGE_SIZE;
        const result = await fetchDeckFactConfidencesPage(deckId, token, {
          limit: CONFIDENCE_PAGE_SIZE,
          offset,
        });
        if (gen !== loadGenRef.current) return;
        const nextTotal = result.total;
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / CONFIDENCE_PAGE_SIZE));
        if (safePage > nextTotalPages && nextTotal > 0) {
          const clamped = nextTotalPages;
          const clampedOffset = (clamped - 1) * CONFIDENCE_PAGE_SIZE;
          const clampedResult = await fetchDeckFactConfidencesPage(deckId, token, {
            limit: CONFIDENCE_PAGE_SIZE,
            offset: clampedOffset,
          });
          if (gen !== loadGenRef.current) return;
          setRows(clampedResult.rows);
          setTotal(clampedResult.total);
          setPage(clamped);
          return;
        }
        setRows(result.rows);
        setTotal(nextTotal);
        setPage(safePage);
      } catch (e) {
        if (gen !== loadGenRef.current) return;
        setRows([]);
        setError(e instanceof Error ? e.message : "Failed to load confidence");
      } finally {
        if (gen === loadGenRef.current) setLoading(false);
      }
    },
    [token, deckId]
  );

  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * CONFIDENCE_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * CONFIDENCE_PAGE_SIZE, total);
  const showPager = totalPages > 1;

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
              <span className="font-medium">p_good</span>. {CONFIDENCE_PAGE_SIZE} per page;
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

            {!deckId || loadingDecks ? null : loading && rows.length === 0 ? (
              <p className="text-muted-foreground">Loading confidence…</p>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground">No facts in this deck.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Showing {rangeStart}–{rangeEnd}
                  {total > 0 ? ` of ${total}` : ""} facts
                  {loading ? " · Loading…" : ""}
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
                {showPager && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading || page <= 1}
                      onClick={() => void loadPage(page - 1)}
                    >
                      Previous
                    </Button>
                    {pageItems.map((item, i) =>
                      item === "gap" ? (
                        <span
                          key={`gap-${i}`}
                          className="px-1 text-sm text-muted-foreground select-none"
                          aria-hidden
                        >
                          …
                        </span>
                      ) : (
                        <Button
                          key={item}
                          type="button"
                          variant={item === page ? "default" : "outline"}
                          className="min-w-10 tabular-nums"
                          disabled={loading}
                          aria-current={item === page ? "page" : undefined}
                          aria-label={`Page ${item}`}
                          onClick={() => {
                            if (item !== page) void loadPage(item);
                          }}
                        >
                          {item}
                        </Button>
                      )
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading || page >= totalPages}
                      onClick={() => void loadPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
