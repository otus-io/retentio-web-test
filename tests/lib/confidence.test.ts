import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CONFIDENCE_PAGE_SIZE,
  factPreview,
  fetchDeckFactConfidencesPage,
  formatPGood,
  sortConfidenceRows,
  type FactConfidenceRow,
} from "@/lib/confidence";
import type { FactItem } from "@/lib/api";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    request: vi.fn(),
  };
});

function row(
  id: string,
  pGood: number,
  preview = "x"
): FactConfidenceRow {
  return {
    fact: { id, entries: [{ text: preview }] },
    confidence: { fact_id: id, score: 0, reports: 0, p_good: pGood },
    preview,
  };
}

describe("factPreview", () => {
  it("returns first non-empty text entry", () => {
    const fact: FactItem = {
      id: "f1",
      entries: [{ text: "  " }, { text: "hello" }, { text: "world" }],
    };
    expect(factPreview(fact)).toBe("hello");
  });

  it("returns placeholder when no text", () => {
    expect(factPreview({ id: "f1", entries: [{ audio: "m1" }] })).toBe("(no text)");
  });
});

describe("formatPGood", () => {
  it("formats as percent with one decimal", () => {
    expect(formatPGood(0.5652173913043478)).toBe("56.5%");
  });
});

describe("sortConfidenceRows", () => {
  it("sorts by ascending p_good then fact id", () => {
    const sorted = sortConfidenceRows([row("b", 0.5), row("a", 0.2), row("c", 0.2)]);
    expect(sorted.map((r) => r.fact.id)).toEqual(["a", "c", "b"]);
  });
});

describe("fetchDeckFactConfidencesPage", () => {
  beforeEach(() => {
    vi.mocked(api.request).mockReset();
  });

  it("loads deck confidence page then fact previews for those ids", async () => {
    vi.mocked(api.request).mockImplementation(async (path: string) => {
      if (path.includes("/confidence?") || path.endsWith("/confidence")) {
        return {
          data: {
            items: [
              { fact_id: "f1", score: 1, reports: 2, p_good: 0.1 },
              { fact_id: "f2", score: 10, reports: 0, p_good: 0.5 },
            ],
          },
          meta: { msg: "ok", has_more: true, total: 100, limit: 50, offset: 0, count: 2 },
        };
      }
      if (path.includes("/facts/f1")) {
        return { data: { fact: { id: "f1", entries: [{ text: "one" }] } } };
      }
      if (path.includes("/facts/f2")) {
        return { data: { fact: { id: "f2", entries: [{ text: "two" }] } } };
      }
      throw new Error(`unexpected path ${path}`);
    });

    const page = await fetchDeckFactConfidencesPage("deck1", "tok", { offset: 0 });

    expect(api.request).toHaveBeenCalledWith(
      `/api/decks/deck1/confidence?limit=${CONFIDENCE_PAGE_SIZE}&offset=0`,
      { token: "tok" }
    );
    expect(page.hasMore).toBe(true);
    expect(page.total).toBe(100);
    expect(page.nextOffset).toBe(2);
    expect(page.rows.map((r) => r.fact.id)).toEqual(["f1", "f2"]);
    expect(page.rows.map((r) => r.preview)).toEqual(["one", "two"]);
  });
});
