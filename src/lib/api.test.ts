import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  request,
  uploadMultipart,
  buildSiblingTemplate,
  buildTemplateWithSplit,
  buildTemplateForRequest,
  entryToDisplayString,
  cardEntryToRenderItems,
  fileLooksLikeJson,
  fetchAllDeckFacts,
  fetchAllUserMedia,
  fetchDeckFactsPage,
  fetchDeckFactsUnpaginated,
  publishDeck,
  importDeck,
  getDeckUpdates,
  syncDeck,
  resolveMediaFetchUrl,
  normalizeStoredMediaRef,
  isImportedDeck,
  isPublishedSourceDeck,
  deckHasUpdatesAvailable,
  LIST_PAGINATION_DEFAULT_LIMIT,
  type GetNextCardRes,
} from "./api";

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

describe("buildSiblingTemplate", () => {
  it("returns empty array for fieldCount < 1", () => {
    expect(buildSiblingTemplate(0)).toEqual([]);
  });

  it("returns two templates for 1 field", () => {
    expect(buildSiblingTemplate(1)).toEqual([[[0], []], [[], [0]]]);
  });

  it("returns [[[0],[1]], [[1],[0]]] for 2 fields", () => {
    expect(buildSiblingTemplate(2)).toEqual([
      [[0], [1]],
      [[1], [0]],
    ]);
  });

  it("returns primary + reversed for 3 fields", () => {
    expect(buildSiblingTemplate(3)).toEqual([
      [[0], [1, 2]],
      [
        [1, 2],
        [0],
      ],
    ]);
  });

  it("respects split: 3 fields with split 2 gives front [0,1] back [2]", () => {
    expect(buildSiblingTemplate(3, 2)).toEqual([
      [
        [0, 1],
        [2],
      ],
      [[2], [0, 1]],
    ]);
  });
});

describe("buildTemplateWithSplit", () => {
  it("returns [[0],[1,2]] for 3 fields split 1", () => {
    expect(buildTemplateWithSplit(3, 1)).toEqual([[0], [1, 2]]);
  });
  it("returns [[0,1],[2]] for 3 fields split 2", () => {
    expect(buildTemplateWithSplit(3, 2)).toEqual([[0, 1], [2]]);
  });
  it("returns all front for 3 fields split 3", () => {
    expect(buildTemplateWithSplit(3, 3)).toEqual([[0, 1, 2], []]);
  });
});

describe("buildTemplateForRequest", () => {
  it("returns {} for fieldCount < 1", () => {
    expect(buildTemplateForRequest(0, 1, false)).toEqual({});
  });
  it("returns sibling template when sibling true", () => {
    expect(buildTemplateForRequest(2, 1, true)).toEqual({
      template: [
        [[0], [1]],
        [[1], [0]],
      ],
    });
  });
  it("returns one template when split > 1 and not sibling", () => {
    expect(buildTemplateForRequest(3, 2, false)).toEqual({
      template: [[[0, 1], [2]]],
    });
  });
  it("returns {} when split 1 and not sibling", () => {
    expect(buildTemplateForRequest(2, 1, false)).toEqual({});
  });
  it("returns front-only template when split equals fieldCount", () => {
    expect(buildTemplateForRequest(3, 3, false)).toEqual({
      template: [[[0, 1, 2], []]],
    });
  });
});

describe("request", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns parsed JSON on success", async () => {
    const payload = { data: { token: "abc" }, meta: { expires: "2099" } };
    mockFetch.mockResolvedValueOnce(makeResponse(payload));
    const res = await request("/auth/login", { method: "POST", body: JSON.stringify({}) });
    expect(res).toEqual(payload);
  });

  it("sets Content-Type: application/json when body is present", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}));
    await request("/test", { body: JSON.stringify({ x: 1 }) });
    const [, init] = mockFetch.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get("Content-Type")).toBe("application/json");
  });

  it("does not set Content-Type when no body", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}));
    await request("/test");
    const [, init] = mockFetch.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get("Content-Type")).toBeNull();
  });

  it("sets Authorization header when token is provided", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}));
    await request("/test", { token: "mytoken" });
    const [, init] = mockFetch.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get("Authorization")).toBe("Bearer mytoken");
  });

  it("does not set Authorization when token is null", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}));
    await request("/test", { token: null });
    const [, init] = mockFetch.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("returns empty object for blank response body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      statusText: "OK",
      text: () => Promise.resolve("   "),
      json: () => Promise.resolve({}),
    });
    const res = await request<object>("/test");
    expect(res).toEqual({});
  });

  it("throws error with msg from JSON on failure", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ msg: "Invalid credentials" }, false, "Unauthorized"));
    await expect(request("/auth/login", { method: "POST" })).rejects.toThrow("Invalid credentials");
  });

  it("falls back to statusText when error body has no msg", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, false, "Internal Server Error"));
    await expect(request("/test")).rejects.toThrow("Internal Server Error");
  });

  it("uses the correct URL", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}));
    await request("/api/decks");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toMatch(/\/api\/decks$/);
  });
});

describe("uploadMultipart", () => {
  beforeEach(() => mockFetch.mockReset());

  it("sends POST with FormData", async () => {
    const payload = { data: { id: "m1" }, meta: { msg: "ok" } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      statusText: "OK",
      json: () => Promise.resolve(payload),
    });
    const form = new FormData();
    form.append("file", new Blob(["data"]), "test.png");
    const res = await uploadMultipart("/api/media", form, "tok");
    expect(res).toEqual(payload);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(form);
  });

  it("sets Authorization when token provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      statusText: "OK",
      json: () => Promise.resolve({}),
    });
    const form = new FormData();
    await uploadMultipart("/api/media", form, "mytoken");
    const [, init] = mockFetch.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get("Authorization")).toBe("Bearer mytoken");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Forbidden",
      json: () => Promise.resolve({ msg: "Forbidden" }),
    });
    await expect(uploadMultipart("/api/media", new FormData())).rejects.toThrow("Forbidden");
  });

  it("accepts video file in FormData and returns media id", async () => {
    const payload = { data: { id: "vid123" }, meta: { msg: "media uploaded" } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      statusText: "OK",
      json: () => Promise.resolve(payload),
    });
    const form = new FormData();
    form.append("file", new File(["video bytes"], "clip.mp4", { type: "video/mp4" }));
    const res = await uploadMultipart("/api/media", form, "tok");
    expect(res).toEqual(payload);
    expect((res as { data?: { id?: string } }).data?.id).toBe("vid123");
  });
});

describe("entryToDisplayString", () => {
  it("returns text when present", () => {
    expect(entryToDisplayString({ text: "Hello" })).toBe("Hello");
  });
  it("returns audio:id when entry has audio only", () => {
    expect(entryToDisplayString({ audio: "aud1" })).toBe("audio:aud1");
  });
  it("returns image:id when entry has image only", () => {
    expect(entryToDisplayString({ image: "img1" })).toBe("image:img1");
  });
  it("returns video:id when entry has video only", () => {
    expect(entryToDisplayString({ video: "vid1" })).toBe("video:vid1");
  });
  it("returns json:id when entry has json only", () => {
    expect(entryToDisplayString({ json: "j1" })).toBe("json:j1");
  });
  it("prefers text over media", () => {
    expect(entryToDisplayString({ text: "Word", audio: "a1" })).toBe("Word");
  });
});

describe("fileLooksLikeJson", () => {
  it("detects application/json and .json extension", () => {
    expect(fileLooksLikeJson(new File(["{}"], "x.bin", { type: "application/json" }))).toBe(true);
    expect(fileLooksLikeJson(new File(["{}"], "data.json", { type: "" }))).toBe(true);
    expect(fileLooksLikeJson(new File(["x"], "note.txt", { type: "text/plain" }))).toBe(false);
  });
});

describe("GetNextCard response shape (front/back entry objects)", () => {
  it("accepts response with front and back entry arrays (field + text)", () => {
    const res: GetNextCardRes = {
      data: {
        card: {
          id: "c1",
          fact_id: "f1",
          template: [[0], [1]],
          last_review: 1704067200,
          due_date: 1704153600,
          hidden: false,
          created_at: 1704067200,
          front: [{ field: "Word", text: "Apple" }],
          back: [{ field: "Translation", text: "苹果" }],
        },
        urgency: 2.598,
      },
      meta: { msg: "Next urgent card retrieved successfully" },
    };
    expect(res.data.card.front).toHaveLength(1);
    expect(res.data.card.back).toHaveLength(1);
    expect(res.data.card.front[0].text).toBe("Apple");
    expect(res.data.card.back[0].text).toBe("苹果");
  });

  it("accepts front-only response with empty back array", () => {
    const res: GetNextCardRes = {
      data: {
        card: {
          id: "c1",
          fact_id: "f1",
          template: [[0], []],
          last_review: 1704067200,
          due_date: 1704153600,
          hidden: false,
          created_at: 1704067200,
          front: [{ field: "Question", text: "Only front" }],
          back: [],
        },
        urgency: 1.0,
      },
      meta: { msg: "Next urgent card retrieved successfully" },
    };
    expect(res.data.card.front).toHaveLength(1);
    expect(res.data.card.back).toHaveLength(0);
  });

  it("accepts entries with sibling text, audio, image, and video", () => {
    const res: GetNextCardRes = {
      data: {
        card: {
          id: "c1",
          fact_id: "f1",
          template: [[0, 1], [2, 3]],
          last_review: 1704067200,
          due_date: 1704153600,
          hidden: false,
          created_at: 1704067200,
          front: [{ field: "Front", text: "Word", audio: "abc123" }],
          back: [
            { field: "Picture", image: "img456" },
            { field: "Clip", video: "vid789" },
          ],
        },
        urgency: 1.2,
      },
      meta: {},
    };
    expect(res.data.card.front[0].audio).toBe("abc123");
    expect(res.data.card.back[0].image).toBe("img456");
    expect(res.data.card.back[1].video).toBe("vid789");
  });

  it("accepts entries with optional field", () => {
    const res: GetNextCardRes = {
      data: {
        card: {
          id: "c1",
          fact_id: "f1",
          template: [[0], [1]],
          last_review: 0,
          due_date: 0,
          hidden: false,
          created_at: 0,
          front: [{ text: "No label" }],
          back: [{ image: "img1" }],
        },
        urgency: 0,
      },
      meta: {},
    };
    expect(res.data.card.front[0].text).toBe("No label");
    expect(res.data.card.back[0].image).toBe("img1");
  });

  it("accepts media values as full URLs (backend returns URL when Host is set)", () => {
    const res: GetNextCardRes = {
      data: {
        card: {
          id: "c1",
          fact_id: "f1",
          template: [[0, 1], [2]],
          last_review: 1704067200,
          due_date: 1704153600,
          hidden: false,
          created_at: 1704067200,
          front: [
            { field: "Word", text: "Apple", image: "https://api.example.com/api/media/im1" },
          ],
          back: [{ field: "Audio", audio: "https://api.example.com/api/media/au1" }],
        },
        urgency: 1.0,
      },
      meta: {},
    };
    expect(res.data.card.front[0].image).toContain("/api/media/im1");
    expect(res.data.card.back[0].audio).toContain("/api/media/au1");
  });
});

describe("cardEntryToRenderItems", () => {
  it("orders text, audio, image, video, json", () => {
    const items = cardEntryToRenderItems({
      text: "T",
      audio: "a",
      image: "i",
      video: "v",
      json: "j",
    });
    expect(items.map((x) => x.type)).toEqual(["text", "audio", "image", "video", "json"]);
    expect(items.map((x) => x.value)).toEqual(["T", "a", "i", "v", "j"]);
  });
});

describe("fetchDeckFactsUnpaginated", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("requests facts without limit or offset", async () => {
    const deckId = "deck1";
    mockFetch.mockResolvedValue(
      makeResponse({
        data: { facts: [{ id: "f1", entries: [] }] },
        meta: { msg: "ok" },
      })
    );
    const res = await fetchDeckFactsUnpaginated(deckId, "tok");
    expect(res.data.facts).toHaveLength(1);
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain(`/api/decks/${deckId}/facts`);
    expect(url).not.toContain("limit=");
  });
});

describe("fetchDeckFactsPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("requests default limit and offset", async () => {
    const deckId = "deck1";
    mockFetch.mockResolvedValue(
      makeResponse({
        data: { facts: [{ id: "f1", entries: [] }] },
        meta: { msg: "ok", has_more: false, count: 1, limit: 50, offset: 0, total: 1 },
      })
    );
    const res = await fetchDeckFactsPage(deckId, "tok");
    expect(res.data.facts).toHaveLength(1);
    expect(res.meta.total).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain(`/api/decks/${deckId}/facts?limit=${LIST_PAGINATION_DEFAULT_LIMIT}&offset=0`);
  });
});

describe("fetchAllDeckFacts", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("aggregates pages while meta.has_more is true", async () => {
    const deckId = "deck1";
    const token = "tok";
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain(`/api/decks/${deckId}/facts?limit=${LIST_PAGINATION_DEFAULT_LIMIT}&`);
      if (url.includes("offset=0")) {
        return Promise.resolve(
          makeResponse({
            data: {
              facts: [
                { id: "f1", entries: [{ text: "a" }] },
                { id: "f2", entries: [{ text: "b" }] },
              ],
            },
            meta: { msg: "ok", has_more: true, count: 2 },
          })
        );
      }
      if (url.includes("offset=2")) {
        return Promise.resolve(
          makeResponse({
            data: { facts: [{ id: "f3", entries: [{ text: "c" }] }] },
            meta: { msg: "ok", has_more: false, count: 1 },
          })
        );
      }
      return Promise.reject(new Error(`unexpected fetch url: ${url}`));
    });

    const facts = await fetchAllDeckFacts(deckId, token);
    expect(facts.map((f) => f.id)).toEqual(["f1", "f2", "f3"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("stops after one page when has_more is absent or false", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({
        data: { facts: [{ id: "x", entries: [] }] },
        meta: { msg: "ok" },
      })
    );
    const facts = await fetchAllDeckFacts("d", "t");
    expect(facts).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("fetchAllUserMedia", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("aggregates media pages until has_more is false", async () => {
    const row = {
      id: "m1",
      owner: "u",
      filename: "a.png",
      mime: "image/png",
      size: 10,
      checksum: "sha:x",
      created_at: 100,
    };
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain(`/api/media?limit=${LIST_PAGINATION_DEFAULT_LIMIT}&`);
      if (url.includes("offset=0")) {
        return Promise.resolve(
          makeResponse({
            data: [row],
            meta: { count: 1, has_more: true },
          })
        );
      }
      if (url.includes("offset=1")) {
        return Promise.resolve(
          makeResponse({
            data: [{ ...row, id: "m2", filename: "b.png" }],
            meta: { count: 1, has_more: false },
          })
        );
      }
      return Promise.reject(new Error(`unexpected fetch url: ${url}`));
    });

    const items = await fetchAllUserMedia("tok");
    expect(items.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("media URL helpers", () => {
  it("resolveMediaFetchUrl rewrites absolute API media URLs to configured base", () => {
    expect(
      resolveMediaFetchUrl(
        "https://api.retentio.app:8443/api/media/1ink7csbmb?v=1",
        "http://localhost:8080"
      )
    ).toBe("http://localhost:8080/api/media/1ink7csbmb?v=1");
  });

  it("resolveMediaFetchUrl handles bare id with version query", () => {
    expect(resolveMediaFetchUrl("abc123?v=2", "http://localhost:8080")).toBe(
      "http://localhost:8080/api/media/abc123?v=2"
    );
  });

  it("normalizeStoredMediaRef strips host from stored URLs", () => {
    expect(
      normalizeStoredMediaRef("https://api.retentio.app:8443/api/media/xyz?v=1")
    ).toBe("xyz?v=1");
  });
});

describe("deck sharing helpers", () => {
  it("isImportedDeck is true when source_deck_id is set", () => {
    expect(isImportedDeck({ source_deck_id: "src1" })).toBe(true);
    expect(isImportedDeck({})).toBe(false);
    expect(isImportedDeck({ source_deck_id: "  " })).toBe(false);
  });

  it("isPublishedSourceDeck is true when published_version > 0", () => {
    expect(isPublishedSourceDeck({ published_version: 1 })).toBe(true);
    expect(isPublishedSourceDeck({ published_version: 0 })).toBe(false);
    expect(isPublishedSourceDeck({})).toBe(false);
  });

  it("deckHasUpdatesAvailable compares source and latest versions", () => {
    expect(
      deckHasUpdatesAvailable({ source_version: 1, latest_version: 2 } as never)
    ).toBe(true);
    expect(
      deckHasUpdatesAvailable({ source_version: 2, latest_version: 2 } as never)
    ).toBe(false);
  });
});

describe("deck sharing API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("publishDeck POSTs to /api/decks/{id}/publish", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: { published_version: 1, visibility: "public" },
        meta: { msg: "published" },
      })
    );
    const res = await publishDeck("deck1", { visibility: "public" }, "tok");
    expect(res.data.published_version).toBe(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, { headers: Headers; method: string }];
    expect(url).toContain("/api/decks/deck1/publish");
    expect(init.method).toBe("POST");
    expect(init.headers.get("Authorization")).toBe("Bearer tok");
  });

  it("importDeck POSTs to /api/decks/import", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: {
          id: "imp1",
          source_deck_id: "src1",
          source_version: 1,
          imported_at: "2026-01-01T00:00:00Z",
        },
        meta: { msg: "imported" },
      })
    );
    const res = await importDeck({ source_deck_id: "src1" }, "tok");
    expect(res.data.id).toBe("imp1");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/decks/import");
  });

  it("getDeckUpdates GETs /api/decks/{id}/updates", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: {
          source_version: 1,
          latest_version: 2,
          added_facts: [],
          removed_facts: [],
          edited_facts: [],
          media_changes: [],
        },
        meta: { msg: "ok" },
      })
    );
    const res = await getDeckUpdates("imp1", "tok");
    expect(res.data.latest_version).toBe(2);
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/decks/imp1/updates");
  });

  it("syncDeck POSTs to /api/decks/{id}/sync", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: { source_version: 2 },
        meta: { msg: "synced" },
      })
    );
    const res = await syncDeck("imp1", { target_version: 2 }, "tok");
    expect(res.data.source_version).toBe(2);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/decks/imp1/sync");
    expect(init.method).toBe("POST");
  });
});
