import type { TagItem } from "@/lib/tags";

/** Case-insensitive substring match on tag name. Empty query returns all tags. */
export function filterTagsByQuery(tags: TagItem[], query: string): TagItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return tags;
  return tags.filter((t) => t.name.toLowerCase().includes(q));
}
