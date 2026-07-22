import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTag,
  listTags,
  getTag,
  updateTag,
  deleteTag,
  getTagFacts,
  getDeckTags,
  getFactTags,
  addTagToDeck,
  removeTagFromDeck,
  addTagToFact,
  removeTagFromFact,
  deckCardQueryWithTag,
  getNextCard,
  getDeckCards,
} from "./tags";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(body: unknown, ok = true, statusText = "OK") {
  const json = JSON.stringify(body);
  return {
    ok,
    statusText,
    text: () => Promise.resolve(json),
    json: () => Promise.resolve(body),
  };
}

describe("tags API", () => {
  beforeEach(() => mockFetch.mockReset());

  it("createTag POSTs /api/tags", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: { tag: { id: "abcd1234", name: "verb", description: "" } },
        meta: { msg: "ok" },
      })
    );
    const res = await createTag({ name: "verb" }, "tok");
    expect(res.data.tag.id).toBe("abcd1234");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/tags$/);
    expect(init.method).toBe("POST");
    expect(init.headers && new Headers(init.headers).get("Authorization")).toBe("Bearer tok");
  });

  it("listTags GETs /api/tags", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: {
          tags: [
            {
              id: "t1",
              name: "GRE",
              description: "",
              deck_count: 2,
              fact_count: 0,
              used_on: ["deck"],
            },
          ],
        },
        meta: { msg: "ok" },
      })
    );
    const res = await listTags("tok");
    expect(res.data.tags[0].deck_count).toBe(2);
    expect(res.data.tags[0].used_on).toEqual(["deck"]);
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/tags");
    expect(url).not.toContain("used_on");
  });

  it("listTags normalizes null tags array", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: null }, meta: { msg: "ok" } })
    );
    const res = await listTags("tok");
    expect(res.data.tags).toEqual([]);
  });

  it("listTags with used_on=deck adds deck picker query", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: [] }, meta: { msg: "ok" } })
    );
    await listTags("tok", { usedOn: "deck" });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("used_on=deck");
  });

  it("listTags with used_on=deck and deckId adds deck_id query", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: [] }, meta: { msg: "ok" } })
    );
    await listTags("tok", { usedOn: "deck", deckId: "deck1" });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("used_on=deck");
    expect(url).toContain("deck_id=deck1");
  });

  it("listTags with used_on=fact requires deckId", async () => {
    await expect(listTags("tok", { usedOn: "fact" })).rejects.toThrow(/deckId is required/i);
  });

  it("listTags with used_on=fact and deckId adds query params", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: [] }, meta: { msg: "ok" } })
    );
    await listTags("tok", { usedOn: "fact", deckId: "deck1" });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("used_on=fact");
    expect(url).toContain("deck_id=deck1");
    expect(url).not.toContain("unused=");
  });

  it("listTags unused requires usedOn=fact and deckId", async () => {
    await expect(listTags("tok", { unused: "only" })).rejects.toThrow(
      /unused is only valid/i
    );
    await expect(listTags("tok", { usedOn: "deck", unused: "exclude" })).rejects.toThrow(
      /unused is only valid/i
    );
  });

  it("listTags with unused=exclude adds unused query", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: [] }, meta: { msg: "ok" } })
    );
    await listTags("tok", { usedOn: "fact", deckId: "deck1", unused: "exclude" });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("used_on=fact");
    expect(url).toContain("deck_id=deck1");
    expect(url).toContain("unused=exclude");
  });

  it("listTags with unused=only adds unused query", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: [] }, meta: { msg: "ok" } })
    );
    await listTags("tok", { usedOn: "fact", deckId: "deck1", unused: "only" });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("unused=only");
  });

  it("getTag GETs /api/tags/{id}", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: { tag: { id: "t1", name: "verb", description: "pos" } },
        meta: { msg: "ok" },
      })
    );
    const res = await getTag("t1", "tok");
    expect(res.data.tag.name).toBe("verb");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/tags/t1");
  });

  it("updateTag PATCHes /api/tags/{id}", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: { tag: { id: "t1", name: "Renamed", description: "n" } },
        meta: { msg: "ok" },
      })
    );
    await updateTag("t1", { name: "Renamed" }, "tok");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/tags/t1");
    expect(init.method).toBe("PATCH");
  });

  it("deleteTag DELETEs /api/tags/{id}", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { decks_untagged: 2 }, meta: { msg: "ok" } })
    );
    const res = await deleteTag("t1", "tok");
    expect(res.data.decks_untagged).toBe(2);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });

  it("getTagFacts GETs /api/tags/{id}/facts", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: { facts: [{ deck_id: "d1", fact_id: "f1" }] },
        meta: { msg: "ok" },
      })
    );
    const res = await getTagFacts("t1", "tok");
    expect(res.data.facts).toHaveLength(1);
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/tags/t1/facts");
  });

  it("getDeckTags GETs deck tags and normalizes null", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: null }, meta: { msg: "ok" } })
    );
    const res = await getDeckTags("deck1", "tok");
    expect(res.data.tags).toEqual([]);
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/decks/deck1/tags");
  });

  it("getFactTags GETs fact tags and normalizes null", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: null }, meta: { msg: "ok" } })
    );
    const res = await getFactTags("d1", "f1", "tok");
    expect(res.data.tags).toEqual([]);
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/decks/d1/facts/f1/tags");
  });

  it("addTagToDeck PUTs deck tag association", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: [] }, meta: { msg: "ok" } })
    );
    await addTagToDeck("deck1", "tag1", "tok");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/decks/deck1/tags/tag1");
    expect(init.method).toBe("PUT");
  });

  it("removeTagFromDeck DELETEs deck tag association", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: [] }, meta: { msg: "ok" } })
    );
    await removeTagFromDeck("deck1", "tag1", "tok");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/decks/deck1/tags/tag1");
    expect(init.method).toBe("DELETE");
  });

  it("addTagToFact PUTs fact tag association", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: [] }, meta: { msg: "ok" } })
    );
    await addTagToFact("d1", "f1", "t1", "tok");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/decks/d1/facts/f1/tags/t1");
    expect(init.method).toBe("PUT");
  });

  it("removeTagFromFact DELETEs fact tag association", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { tags: [] }, meta: { msg: "ok" } })
    );
    await removeTagFromFact("d1", "f1", "t1", "tok");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/decks/d1/facts/f1/tags/t1");
  });

  it("deckCardQueryWithTag builds tag_id query", () => {
    expect(deckCardQueryWithTag()).toBe("");
    expect(deckCardQueryWithTag("  ")).toBe("");
    expect(deckCardQueryWithTag("abc12345")).toBe("?tag_id=abc12345");
  });

  it("getNextCard appends tag_id when provided", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ data: { card: {} }, meta: {} }));
    await getNextCard("deck1", "tok", "tag9");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/decks/deck1/card?tag_id=tag9");
  });

  it("getDeckCards appends tag_id when provided", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ data: { cards: [] }, meta: {} }));
    await getDeckCards("deck1", "tok", "tag9");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/decks/deck1/cards?tag_id=tag9");
  });
});
