import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { request, type DeckCardListItem, type GetCardsRes } from "@/lib/api";
import { listTags } from "@/lib/tags";
import { formatUnixSecondsUtc } from "@/lib/unixTime";

export type DeckAllCardsFilter = "all" | "Hidden" | "Unseen" | "Due" | "Seen";

export type GetCardsData = GetCardsRes["data"];

export function buildGetAllCardsPath(deckId: string, tagId: string): string {
  const deckPath = `/api/decks/${encodeURIComponent(deckId)}/cards`;
  const trimmedTagId = tagId.trim();
  if (!trimmedTagId) return deckPath;
  return `${deckPath}?tag_id=${encodeURIComponent(trimmedTagId)}`;
}

function bucketDeckCards(cards: DeckCardListItem[], nowUnix = Math.floor(Date.now() / 1000)) {
  const hidden: DeckCardListItem[] = [];
  const unseen: DeckCardListItem[] = [];
  const due: DeckCardListItem[] = [];
  const seen: DeckCardListItem[] = [];
  for (const card of cards) {
    if (card.hidden) {
      hidden.push(card);
      continue;
    }
    const isUnseen = card.due_date - card.last_review === 1;
    if (isUnseen) unseen.push(card);
    if (card.due_date <= nowUnix) due.push(card);
    if (card.due_date > nowUnix && !isUnseen) seen.push(card);
  }
  return { hidden, unseen, due, seen };
}

function idSet(list: DeckCardListItem[]): Set<string> {
  return new Set(list.map((c) => c.id));
}

/** Rows for the selected filter — buckets `data.cards` with the same rules as backend stats. */
export function pickCardsForFilter(data: GetCardsData, filter: DeckAllCardsFilter): DeckCardListItem[] {
  const cards = data.cards ?? [];
  const buckets = bucketDeckCards(cards);
  switch (filter) {
    case "all":
      return cards;
    case "Hidden":
      return buckets.hidden;
    case "Unseen":
      return buckets.unseen;
    case "Due":
      return buckets.due;
    case "Seen":
      return buckets.seen;
    default:
      return cards;
  }
}

/** Category column from card buckets (same semantics as filter tabs). */
export function categoryLabelForGetCardsRow(card: DeckCardListItem, data: GetCardsData): string {
  const buckets = bucketDeckCards(data.cards ?? []);
  const hidden = idSet(buckets.hidden);
  const unseen = idSet(buckets.unseen);
  const due = idSet(buckets.due);
  const seen = idSet(buckets.seen);
  if (hidden.has(card.id)) return "Hidden";
  const parts: string[] = [];
  if (unseen.has(card.id)) parts.push("Unseen");
  if (due.has(card.id)) parts.push("Due");
  if (parts.length > 0) return parts.join(", ");
  if (seen.has(card.id)) return "Seen";
  return "—";
}

const FILTER_OPTIONS: Array<{ value: DeckAllCardsFilter; label: string }> = [
  { value: "all", label: "All cards" },
  { value: "Unseen", label: "Unseen" },
  { value: "Due", label: "Due" },
  { value: "Seen", label: "Seen (not due)" },
  { value: "Hidden", label: "Hidden" },
];

interface DeckAllCardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deckName?: string;
  token: string | null;
}

interface FilterTagItem {
  id: string;
  name: string;
  description?: string;
}

export function DeckAllCardsModal({ open, onOpenChange, deckId, deckName, token }: DeckAllCardsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<GetCardsData | null>(null);
  const [filter, setFilter] = useState<DeckAllCardsFilter>("all");
  const [tagId, setTagId] = useState("");
  const [filterTags, setFilterTags] = useState<FilterTagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState("");

  const load = useCallback(async (tagIdOverride?: string) => {
    if (!token || !deckId) return;
    setLoading(true);
    setError("");
    try {
      const effectiveTagId = tagIdOverride ?? tagId;
      const res = await request<GetCardsRes>(buildGetAllCardsPath(deckId, effectiveTagId), { token });
      setData(res.data);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load cards");
    } finally {
      setLoading(false);
    }
  }, [deckId, tagId, token]);

  const loadFilterTags = useCallback(async () => {
    if (!token || !deckId) return;
    setTagsLoading(true);
    setTagsError("");
    try {
      const res = await listTags(token, { usedOn: "fact", deckId, unused: "exclude" });
      const sorted = [...(res.data.tags ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
      setFilterTags(sorted);
    } catch (e) {
      setFilterTags([]);
      setTagsError(e instanceof Error ? e.message : "Failed to load tags");
    } finally {
      setTagsLoading(false);
    }
  }, [deckId, token]);

  useEffect(() => {
    if (!open) return;
    setFilter("all");
    setTagId("");
    void load();
    void loadFilterTags();
  }, [open, load, loadFilterTags]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const cards = pickCardsForFilter(data, filter);
    return cards.map((c) => ({
      card: c,
      categoryLabel: categoryLabelForGetCardsRow(c, data),
    }));
  }, [data, filter]);

  const seenOnlyCount = useMemo(() => {
    if (!data) return 0;
    return bucketDeckCards(data.cards ?? []).seen.length;
  }, [data]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-all-cards-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} aria-hidden="true" />
      <div
        className="relative z-[61] flex max-h-[min(90vh,40rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div>
            <h2 id="deck-all-cards-title" className="text-lg font-semibold">
              Get All Cards
            </h2>
            {deckName && <p className="text-sm text-muted-foreground">{deckName}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading || !token}>
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-3 sm:px-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {data && !loading && (
            <p className="text-sm text-muted-foreground">
              Total {data.stats.cards_count} · Due {data.stats.due_cards} · Unseen {data.stats.unseen_cards} · Seen (not due) {seenOnlyCount}{" "}
              · Hidden {data.stats.hidden_cards}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="deck-all-cards-filter">Show</Label>
              <select
                id="deck-all-cards-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value as DeckAllCardsFilter)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="deck-all-cards-tag-filter">Tags</Label>
              <select
                id="deck-all-cards-tag-filter"
                value={tagId}
                onChange={(e) => {
                  const nextTagId = e.target.value;
                  setTagId(nextTagId);
                  void load(nextTagId);
                }}
                className="h-9 min-w-64 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={loading || tagsLoading}
              >
                <option value="">All tags</option>
                {filterTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name} ({tag.id})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-muted-foreground pb-1">
              {loading ? "Loading…" : `${filteredRows.length} row${filteredRows.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Fact tags already used on facts in this deck.
            </p>
            {tagsError && <p className="text-sm text-destructive">{tagsError}</p>}
            {!tagsLoading && filterTags.length === 0 && (
              <p className="text-sm text-muted-foreground">No tags found.</p>
            )}
            {tagsLoading && <p className="text-sm text-muted-foreground">Loading tags…</p>}
          </div>

          {loading ? (
            <p className="text-muted-foreground">Loading cards…</p>
          ) : filteredRows.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {data?.cards?.length === 0 ? "No cards in this deck." : "No cards match this filter."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-2 py-2 font-medium">Category</th>
                    <th className="px-2 py-2 font-medium">Card ID</th>
                    <th className="px-2 py-2 font-medium">Fact ID</th>
                    <th className="px-2 py-2 font-medium">Last review</th>
                    <th className="px-2 py-2 font-medium">Due</th>
                    <th className="px-2 py-2 font-medium">Hidden</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(({ card, categoryLabel }) => (
                    <tr key={card.id} className="border-b last:border-0">
                      <td className="px-2 py-1.5 whitespace-nowrap">{categoryLabel}</td>
                      <td className="px-2 py-1.5 font-mono text-xs max-w-[10rem] truncate" title={card.id}>
                        {card.id}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs max-w-[10rem] truncate" title={card.fact_id}>
                        {card.fact_id}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {formatUnixSecondsUtc(card.last_review)}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {formatUnixSecondsUtc(card.due_date)}
                      </td>
                      <td className="px-2 py-1.5">{card.hidden ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
