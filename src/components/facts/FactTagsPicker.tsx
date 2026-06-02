import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { normalizeTagName } from "@/components/deck/DeckTagsPicker";
import { TagNameSearchCombo } from "@/components/tags/TagNameSearchCombo";
import { addTagToFact, createTag, listTags, removeTagFromFact, type TagItem } from "@/lib/tags";

export interface FactTagsPickerProps {
  token: string;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  /** Called with full tag objects after a successful add/remove when using factId mode. */
  onTagsUpdated?: (tags: TagItem[]) => void;
  /** Tag objects from the fact API — used to show names before the global tag list loads. */
  tagItems?: TagItem[];
  disabled?: boolean;
  /** When set with factId, add/remove call PUT/DELETE fact tag APIs immediately. */
  deckId?: string;
  factId?: string;
  /** Smaller layout for spreadsheet rows. */
  compact?: boolean;
  /** Prefix for input/select ids when multiple pickers appear on one page. */
  idPrefix?: string;
}

export function FactTagsPicker({
  token,
  selectedIds,
  onSelectedIdsChange,
  onTagsUpdated,
  tagItems,
  disabled = false,
  deckId,
  factId,
  compact = false,
  idPrefix,
}: FactTagsPickerProps) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState("");

  const persistMode = Boolean(deckId && factId);
  const searchId = idPrefix ? `${idPrefix}-fact-tags-search` : "fact-tags-search";

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
    const hintById = new Map((tagItems ?? []).map((t) => [t.id, t]));
    const fromList = selectedIds
      .map((id) => tags.find((t) => t.id === id) ?? hintById.get(id))
      .filter((t): t is TagItem => !!t);
    if (fromList.length === selectedIds.length) return fromList;
    return selectedIds.map((id) => {
      const found = tags.find((t) => t.id === id) ?? hintById.get(id);
      return found ?? { id, name: id, description: "" };
    });
  }, [selectedIds, tags, tagItems]);
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
    onTagsUpdated?.(sorted);
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
    setActionError("");
    if (!persistMode) {
      onSelectedIdsChange([...selectedIds, id]);
      return true;
    }
    setAdding(true);
    try {
      const res = await addTagToFact(deckId!, factId!, id, token);
      mergeTagsIntoList(res.data.tags);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add tag to fact");
      return false;
    } finally {
      setAdding(false);
    }
  }

  async function detachTagId(id: string) {
    setActionError("");
    if (!persistMode) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
      return;
    }
    setAdding(true);
    try {
      const res = await removeTagFromFact(deckId!, factId!, id, token);
      mergeTagsIntoList(res.data.tags);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove tag from fact");
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

  const spaceClass = compact ? "space-y-2" : "space-y-3";

  return (
    <div className={spaceClass}>
      {!compact && (
        <div className="space-y-1">
          <Label htmlFor={searchId}>Tags (optional)</Label>
          <p className="text-xs text-muted-foreground">
            {persistMode
              ? "Search or type a tag name — changes save immediately."
              : (
                <>
                  Search existing tags or type a new name and click Add. Selected tags are sent as{" "}
                  <span className="font-mono">tag_ids</span> when you add the fact.
                </>
              )}
          </p>
        </div>
      )}

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <div className="space-y-1.5">
        {compact && (
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tags</p>
        )}
        {!compact && (
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Selected tags ({selectedIds.length})
          </p>
        )}
        {selectedTags.length === 0 ? (
          compact ? (
            <p className="text-xs text-muted-foreground">No tags</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {persistMode ? "None — add a tag below." : "None — add a tag below, then submit."}
            </p>
          )
        ) : (
          <ul className="flex flex-wrap gap-1.5 list-none">
            {selectedTags.map((t) => (
              <li
                key={t.id}
                className="inline-flex items-center gap-1 rounded-full border bg-primary/10 px-2 py-0.5 text-xs"
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

      <div className="flex flex-wrap items-end gap-2">
        <TagNameSearchCombo
          id={searchId}
          query={query}
          onQueryChange={setQuery}
          availableTags={available}
          onPickTag={handlePickTag}
          onAddQuery={() => void handleAddTag()}
          loading={loading}
          disabled={disabled}
          adding={adding}
          compact={compact}
          hideLabel={compact}
          label="Search or add tag"
        />
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={disabled || adding}
          onClick={() => void handleAddTag()}
        >
          {adding ? "Adding…" : "Add"}
        </Button>
      </div>
    </div>
  );
}
