import { describe, it, expect } from "vitest";
import { filterTagsByQuery } from "@/lib/tagSearch";
import type { TagItem } from "@/lib/tags";

const tags: TagItem[] = [
  { id: "t1", name: "verb", description: "" },
  { id: "t2", name: "JLPT N3", description: "" },
  { id: "t3", name: "noun", description: "" },
];

describe("filterTagsByQuery", () => {
  it("returns all tags when query is empty", () => {
    expect(filterTagsByQuery(tags, "")).toHaveLength(3);
    expect(filterTagsByQuery(tags, "   ")).toHaveLength(3);
  });

  it("filters by case-insensitive substring", () => {
    expect(filterTagsByQuery(tags, "n")).toEqual([
      { id: "t2", name: "JLPT N3", description: "" },
      { id: "t3", name: "noun", description: "" },
    ]);
    expect(filterTagsByQuery(tags, "jlpt")).toEqual([{ id: "t2", name: "JLPT N3", description: "" }]);
  });
});
