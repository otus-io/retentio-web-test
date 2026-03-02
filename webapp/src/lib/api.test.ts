import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  request,
  uploadMultipart,
  buildSiblingTemplate,
  buildTemplateWithSplit,
  buildTemplateForRequest,
  type GetNextCardRes,
  type FrontBackSegment,
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
});

describe("GetNextCard response shape (front/back segments)", () => {
  it("accepts response with front and back segment arrays (field, type, value)", () => {
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
          front: [{ field: "Word", type: "text", value: "Apple" }],
          back: [{ field: "Translation", type: "text", value: "苹果" }],
        },
        urgency: 2.598,
      },
      meta: { msg: "Next urgent card retrieved successfully" },
    };
    expect(res.data.card.front).toHaveLength(1);
    expect(res.data.card.back).toHaveLength(1);
    expect((res.data.card.front as FrontBackSegment[])[0].type).toBe("text");
    expect((res.data.card.front as FrontBackSegment[])[0].value).toBe("Apple");
    expect((res.data.card.back as FrontBackSegment[])[0].value).toBe("苹果");
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
          front: [{ field: "Question", type: "text", value: "Only front" }],
          back: [],
        },
        urgency: 1.0,
      },
      meta: { msg: "Next urgent card retrieved successfully" },
    };
    expect(res.data.card.front).toHaveLength(1);
    expect(res.data.card.back).toHaveLength(0);
  });

  it("accepts segments with audio, image, and video", () => {
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
            { field: "Front", type: "text", value: "Word" },
            { field: "Pronunciation", type: "audio", value: "abc123" },
          ],
          back: [{ field: "Picture", type: "image", value: "img456" }],
        },
        urgency: 1.2,
      },
      meta: {},
    };
    expect((res.data.card.front as FrontBackSegment[])[1].type).toBe("audio");
    expect((res.data.card.front as FrontBackSegment[])[1].value).toBe("abc123");
    expect((res.data.card.back as FrontBackSegment[])[0].type).toBe("image");
    expect((res.data.card.back as FrontBackSegment[])[0].value).toBe("img456");
  });

  it("accepts segments with empty field", () => {
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
          front: [{ field: "", type: "text", value: "No label" }],
          back: [{ field: "", type: "image", value: "img1" }],
        },
        urgency: 0,
      },
      meta: {},
    };
    expect((res.data.card.front as FrontBackSegment[])[0].field).toBe("");
    expect((res.data.card.front as FrontBackSegment[])[0].value).toBe("No label");
    expect((res.data.card.back as FrontBackSegment[])[0].field).toBe("");
    expect((res.data.card.back as FrontBackSegment[])[0].type).toBe("image");
  });
});
