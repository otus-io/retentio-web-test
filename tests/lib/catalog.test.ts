import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCatalogDeckById } from "@/lib/catalog";

vi.mock("@/lib/api", () => ({
  getCatalogDeck: vi.fn(),
}));

import { getCatalogDeck } from "@/lib/api";

const mockGet = vi.mocked(getCatalogDeck);

describe("fetchCatalogDeckById", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("returns deck from GET /api/decks/catalog/{id}", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        id: "abc",
        name: "JLPT",
        description: "Core vocab",
        owner: "alice",
        fields: ["En", "Ja"],
        published_version: 1,
        fact_count: 10,
        published_at: "2026-01-01T00:00:00Z",
      },
      meta: { msg: "ok" },
    });
    const deck = await fetchCatalogDeckById("abc");
    expect(deck.description).toBe("Core vocab");
    expect(mockGet).toHaveBeenCalledWith("abc", undefined);
  });
});
