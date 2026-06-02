import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TagNameSearchCombo } from "@/components/tags/TagNameSearchCombo";
import { addTagToDeck, createTag, listTags, removeTagFromDeck, type TagItem } from "@/lib/tags";

const MAX_DECK_TAGS = 20;

/** Match backend tag name normalization (trim, collapse spaces, lowercase). */
export function normalizeTagName(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  return collapsed.toLowerCase();
}

export interface DeckTagsPickerProps {
  token: string;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  disabled?: boolean;
  /** When set, add/remove call PUT/DELETE deck tag APIs immediately (edit deck). */
  deckId?: string;
}

export function DeckTagsPicker({
  token,
  selectedIds,
  onSelectedIdsChange,
  disabled = false,
  deckId,
}: DeckTagsPickerProps) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState("");

  const refreshTags = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const res = await listTags(token);
      const sorted = [...res.data.tags].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
      setTags(sorted);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load tags");
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshTags();
  }, [refreshTags]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const tagsByNorm = useMemo(() => {
    const m = new Map<string, TagItem>();
    for (const t of tags) m.set(normalizeTagName(t.name), t);
    return m;
  }, [tags]);
  const selectedTags = useMemo(() => {
    const fromList = selectedIds
      .map((id) => tags.find((t) => t.id === id))
      .filter((t): t is TagItem => !!t);
    if (fromList.length === selectedIds.length) return fromList;
    return selectedIds.map((id) => {
      const found = tags.find((t) => t.id === id);
      return found ?? { id, name: id, description: "" };
    });
  }, [selectedIds, tags]);
  const available = useMemo(
    () => tags.filter((t) => !selectedSet.has(t.id)),
    [tags, selectedSet]
  );

  function mergeTagsIntoList(tagList: TagItem[]) {
    const sorted = [...tagList].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    setTags((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      for (const t of sorted) byId.set(t.id, t);
      return [...byId.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    });
    onSelectedIdsChange(sorted.map((t) => t.id));
  }

  function mergeTagIntoList(tag: TagItem) {
    setTags((prev) => {
      if (prev.some((t) => t.id === tag.id)) {
        return prev.map((t) => (t.id === tag.id ? tag : t));
      }
      return [...prev, tag].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    });
  }

  async function attachTagId(id: string): Promise<boolean> {
    if (selectedSet.has(id)) return false;
    if (selectedIds.length >= MAX_DECK_TAGS) {
      setActionError(`At most ${MAX_DECK_TAGS} tags per deck`);
      return false;
    }
    setActionError("");
    if (!deckId) {
      onSelectedIdsChange([...selectedIds, id]);
      return true;
    }
    setAdding(true);
    try {
      const res = await addTagToDeck(deckId, id, token);
      mergeTagsIntoList(res.data.tags);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add tag to deck");
      return false;
    } finally {
      setAdding(false);
    }
  }

  async function detachTagId(id: string) {
    setActionError("");
    if (!deckId) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
      return;
    }
    setAdding(true);
    try {
      const res = await removeTagFromDeck(deckId, id, token);
      mergeTagsIntoList(res.data.tags);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove tag from deck");
    } finally {
      setAdding(false);
    }
  }

  function handlePickTag(tag: TagItem) {
    void attachTagId(tag.id);
  }

  async function handleAddTag() {
    const name = query.trim().replace(/\s+/g, " ");
    if (!name) {
      setActionError("Tag name is required");
      return;
    }
    if (selectedIds.length >= MAX_DECK_TAGS) {
      setActionError(`At most ${MAX_DECK_TAGS} tags per deck`);
      return;
    }

    const norm = normalizeTagName(name);
    const existing = tagsByNorm.get(norm);
    if (existing) {
      if (await attachTagId(existing.id)) setQuery("");
      return;
    }

    setActionError("");
    setAdding(true);
    try {
      const res = await createTag({ name }, token);
      const tag = res.data.tag;
      mergeTagIntoList(tag);
      if (await attachTagId(tag.id)) setQuery("");
      void refreshTags();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create tag";
      if (/already exists/i.test(msg)) {
        try {
          const res = await listTags(token);
          const sorted = [...res.data.tags].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          );
          setTags(sorted);
          const match = sorted.find((t) => normalizeTagName(t.name) === norm);
          if (match && (await attachTagId(match.id))) {
            setQuery("");
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setActionError(msg);
    } finally {
      setAdding(false);
    }
  }

  const atLimit = selectedIds.length >= MAX_DECK_TAGS;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="deck-tags-search">Tags (optional)</Label>
        <p className="text-xs text-muted-foreground">
          {deckId
            ? "Search or type a tag name — changes save immediately."
            : (
              <>
                Search existing tags or type a new name and click Add. Selected tags are sent as{" "}
                <span className="font-mono">tag_ids</span> when you create the deck.
              </>
            )}
        </p>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <TagNameSearchCombo
          id="deck-tags-search"
          query={query}
          onQueryChange={setQuery}
          availableTags={available}
          onPickTag={handlePickTag}
          onAddQuery={() => void handleAddTag()}
          loading={loading}
          disabled={disabled || atLimit}
          adding={adding}
          label="Search or add tag"
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || atLimit || adding}
          onClick={() => void handleAddTag()}
        >
          {adding ? "Adding…" : "Add"}
        </Button>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Selected tags ({selectedIds.length})
        </p>
        {selectedTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {deckId ? "None — add a tag above." : "None — add a tag above, then click Create deck."}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 list-none">
            {selectedTags.map((t) => (
              <li
                key={t.id}
                className="inline-flex items-center gap-1 rounded-full border bg-primary/10 px-2.5 py-1 text-sm"
              >
                <span>{t.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                  aria-label={`Remove ${t.name}`}
                  disabled={disabled}
                  onClick={() => void detachTagId(t.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
