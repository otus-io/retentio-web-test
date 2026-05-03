import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { request, type DeckCardListItem, type GetCardsRes } from "@/lib/api";
import { formatUnixSecondsUtc } from "@/lib/unixTime";

export type DeckAllCardsFilter = "all" | "Hidden" | "Unseen" | "Due" | "Seen";

export type GetCardsData = GetCardsRes["data"];

export function buildGetAllCardsPath(deckId: string, tagId: string): string {
  const deckPath = `/api/decks/${encodeURIComponent(deckId)}/cards`;
  const trimmedTagId = tagId.trim();
  if (!trimmedTagId) return deckPath;
  return `${deckPath}?tag_id=${encodeURIComponent(trimmedTagId)}`;
}

function idSet(list: DeckCardListItem[] | undefined): Set<string> {
  return new Set((list ?? []).map((c) => c.id));
}

/** Rows for the selected filter — uses only lists/counts from `GET /api/decks/{id}/cards`. */
export function pickCardsForFilter(data: GetCardsData, filter: DeckAllCardsFilter): DeckCardListItem[] {
  switch (filter) {
    case "all":
      return data.cards ?? [];
    case "Hidden":
      return data.hidden_cards_list ?? [];
    case "Unseen":
      return data.unseen_cards_list ?? [];
    case "Due":
      return data.due_cards_list ?? [];
    case "Seen":
      return data.seen_cards_list ?? [];
    default:
      return data.cards ?? [];
  }
}

/** Category column from server-provided membership lists (same semantics as filter tabs). */
export function categoryLabelForGetCardsRow(card: DeckCardListItem, data: GetCardsData): string {
  const hidden = idSet(data.hidden_cards_list);
  const unseen = idSet(data.unseen_cards_list);
  const due = idSet(data.due_cards_list);
  const seen = idSet(data.seen_cards_list);
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

interface DeckTagItem {
  id: string;
  name: string;
  description?: string;
}

interface GetDeckTagsRes {
  data: { tags: DeckTagItem[] };
  meta?: { msg?: string };
}

interface GetUserTagsRes {
  data: { tags: DeckTagItem[] };
  meta?: { msg?: string };
}

export function DeckAllCardsModal({ open, onOpenChange, deckId, deckName, token }: DeckAllCardsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<GetCardsData | null>(null);
  const [filter, setFilter] = useState<DeckAllCardsFilter>("all");
  const [tagId, setTagId] = useState("");
  const [deckTags, setDeckTags] = useState<DeckTagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState("");
  const [tagSource, setTagSource] = useState<"deck" | "user">("deck");

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

  const loadDeckTags = useCallback(async () => {
    if (!token || !deckId) return;
    setTagsLoading(true);
    setTagsError("");
    try {
      const deckRes = await request<GetDeckTagsRes>(`/api/decks/${encodeURIComponent(deckId)}/tags`, { token });
      const tags = deckRes.data.tags ?? [];
      if (tags.length > 0) {
        setDeckTags(tags);
        setTagSource("deck");
      } else {
        const userRes = await request<GetUserTagsRes>("/api/tags", { token });
        setDeckTags(userRes.data.tags ?? []);
        setTagSource("user");
      }
    } catch (e) {
      setDeckTags([]);
      setTagSource("deck");
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
    void loadDeckTags();
  }, [open, load, loadDeckTags]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const cards = pickCardsForFilter(data, filter);
    return cards.map((c) => ({
      card: c,
      categoryLabel: categoryLabelForGetCardsRow(c, data),
    }));
  }, [data, filter]);

  const seenOnlyCount = data?.seen_cards_list?.length ?? 0;

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
              Total {data.total_cards} · Due {data.due_cards} · Unseen {data.unseen_cards} · Seen (not due) {seenOnlyCount}{" "}
              · Hidden {data.hidden_cards_count}
              {data.orphaned_hidden_cards != null && data.orphaned_hidden_cards > 0
                ? ` · Orphaned hidden ${data.orphaned_hidden_cards}`
                : ""}
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
                {deckTags.map((tag) => (
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
              {tagSource === "deck"
                ? "Deck tags loaded in the dropdown."
                : "No deck tags yet; dropdown shows all your tags."}
            </p>
            {tagsError && <p className="text-sm text-destructive">{tagsError}</p>}
            {!tagsLoading && deckTags.length === 0 && (
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
