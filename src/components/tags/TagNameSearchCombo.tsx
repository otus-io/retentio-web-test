import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filterTagsByQuery } from "@/lib/tagSearch";
import type { TagItem } from "@/lib/tags";

export interface TagNameSearchComboProps {
  id?: string;
  query: string;
  onQueryChange: (value: string) => void;
  availableTags: TagItem[];
  onPickTag: (tag: TagItem) => void;
  /** Called when user confirms Add / Enter with the current query (parent resolves create vs attach). */
  onAddQuery: () => void;
  loading?: boolean;
  disabled?: boolean;
  adding?: boolean;
  compact?: boolean;
  /** When true, omit the visible label (use aria-label on the input). */
  hideLabel?: boolean;
  label?: string;
  placeholder?: string;
  /** When true, show create hint for the current query in the list. */
  showCreateHint?: boolean;
}

export function TagNameSearchCombo({
  id,
  query,
  onQueryChange,
  availableTags,
  onPickTag,
  onAddQuery,
  loading = false,
  disabled = false,
  adding = false,
  compact = false,
  hideLabel = false,
  label = "Search or add tag",
  placeholder,
  showCreateHint = true,
}: TagNameSearchComboProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = useMemo(() => filterTagsByQuery(availableTags, query), [availableTags, query]);
  const trimmedQuery = query.trim().replace(/\s+/g, " ");
  const exactMatch = useMemo(
    () =>
      trimmedQuery
        ? availableTags.some((t) => t.name.trim().replace(/\s+/g, " ").toLowerCase() === trimmedQuery.toLowerCase())
        : false,
    [availableTags, trimmedQuery]
  );

  const optionCount = filtered.length + (showCreateHint && trimmedQuery && !exactMatch ? 1 : 0);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, filtered.length, exactMatch, showCreateHint]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function pickTag(tag: TagItem) {
    onPickTag(tag);
    onQueryChange("");
    setOpen(false);
  }

  function pickHighlighted() {
    if (highlightIndex < filtered.length) {
      pickTag(filtered[highlightIndex]!);
      return;
    }
    if (showCreateHint && trimmedQuery && !exactMatch) {
      onAddQuery();
      setOpen(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      if (optionCount === 0) return;
      setHighlightIndex((i) => (i + 1) % optionCount);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (optionCount === 0) return;
      setHighlightIndex((i) => (i - 1 + optionCount) % optionCount);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && optionCount > 0) {
        pickHighlighted();
        return;
      }
      onAddQuery();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const inputPlaceholder =
    placeholder ??
    (loading ? "Loading tags…" : compact ? "Search or add tag…" : "Type to search or add a tag…");

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 space-y-1">
      {!hideLabel && (
        <Label htmlFor={id} className={compact ? "sr-only" : "text-xs text-muted-foreground"}>
          {label}
        </Label>
      )}
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={hideLabel ? label : undefined}
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={inputPlaceholder}
        disabled={disabled || loading || adding}
        className={compact ? "h-8 text-xs" : undefined}
      />
      {open && !disabled && !loading && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md"
        >
          {filtered.length === 0 && !trimmedQuery && (
            <li className="px-3 py-2 text-muted-foreground">
              {availableTags.length === 0 ? "No tags yet — type a name and Add" : "Type to search tags"}
            </li>
          )}
          {filtered.length === 0 && trimmedQuery && !exactMatch && showCreateHint && (
            <li
              role="option"
              aria-selected={highlightIndex === 0}
              className={`cursor-pointer px-3 py-2 ${highlightIndex === 0 ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onAddQuery();
                setOpen(false);
              }}
            >
              Create &quot;{trimmedQuery}&quot;
            </li>
          )}
          {filtered.map((tag, idx) => (
            <li
              key={tag.id}
              role="option"
              aria-selected={highlightIndex === idx}
              className={`cursor-pointer px-3 py-2 ${highlightIndex === idx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickTag(tag)}
            >
              {tag.name}
            </li>
          ))}
          {filtered.length > 0 && showCreateHint && trimmedQuery && !exactMatch && (
            <li
              role="option"
              aria-selected={highlightIndex === filtered.length}
              className={`cursor-pointer border-t px-3 py-2 text-muted-foreground ${highlightIndex === filtered.length ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onAddQuery();
                setOpen(false);
              }}
            >
              Create &quot;{trimmedQuery}&quot;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
