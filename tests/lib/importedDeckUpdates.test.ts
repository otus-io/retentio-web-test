import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  anyDeckUpdates,
  countDeckUpdates,
  fetchImportedDeckUpdateFlags,
  flagsFromDeckList,
} from "@/lib/importedDeckUpdates";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...mod,
    getDeckUpdates: vi.fn(),
    isImportedDeck: mod.isImportedDeck,
    deckHasUpdatesAvailable: mod.deckHasUpdatesAvailable,
    importedDeckUpdateAvailable: mod.importedDeckUpdateAvailable,
  };
});

const baseDeck = {
  id: "imp1",
  name: "Imported",
  owner: "bob",
  fields: ["A", "B"],
  rate: 20,
  stats: {
    cards_count: 1,
    facts_count: 1,
    due_cards: 0,
    hidden_cards: 0,
    new_cards_today: 0,
    reviewed_cards: 0,
    unseen_cards: 1,
    total_reviews: 0,
    total_reviews_today: 0,
  },
  created_at: "",
  updated_at: "",
};

describe("fetchImportedDeckUpdateFlags", () => {
  beforeEach(() => {
    vi.mocked(api.getDeckUpdates).mockReset();
  });

  it("returns empty object when no imported decks", async () => {
    const flags = await fetchImportedDeckUpdateFlags(
      [{ ...baseDeck, id: "own1" }],
      "tok"
    );
    expect(flags).toEqual({});
    expect(api.getDeckUpdates).not.toHaveBeenCalled();
  });

  it("uses source_update_available from deck list without calling API", async () => {
    const flags = await fetchImportedDeckUpdateFlags(
      [
        {
          ...baseDeck,
          source_deck_id: "src1",
          source_version: 1,
          latest_source_version: 2,
          source_update_available: true,
        },
      ],
      "tok"
    );
    expect(flags).toEqual({ imp1: true });
    expect(api.getDeckUpdates).not.toHaveBeenCalled();
  });

  it("marks imported deck when updates are available via API", async () => {
    vi.mocked(api.getDeckUpdates).mockResolvedValue({
      data: {
        source_version: 1,
        latest_version: 2,
        added_facts: [],
        removed_facts: [],
        edited_facts: [],
        media_changes: [],
      },
      meta: { msg: "ok" },
    });
    const flags = await fetchImportedDeckUpdateFlags(
      [{ ...baseDeck, source_deck_id: "src1", source_version: 1 }],
      "tok"
    );
    expect(flags).toEqual({ imp1: true });
  });

  it("returns false on API error", async () => {
    vi.mocked(api.getDeckUpdates).mockRejectedValue(new Error("fail"));
    const flags = await fetchImportedDeckUpdateFlags(
      [{ ...baseDeck, source_deck_id: "src1", source_version: 1 }],
      "tok"
    );
    expect(flags).toEqual({ imp1: false });
  });
});

describe("flagsFromDeckList", () => {
  it("builds flags from deck rows with update fields", () => {
    expect(
      flagsFromDeckList([
        { ...baseDeck, source_deck_id: "s1", source_version: 1, latest_source_version: 2 },
        { ...baseDeck, id: "own", source_deck_id: undefined },
      ])
    ).toEqual({ imp1: true });
  });
});

describe("countDeckUpdates / anyDeckUpdates", () => {
  it("counts true entries", () => {
    expect(countDeckUpdates({ a: true, b: false, c: true })).toBe(2);
    expect(anyDeckUpdates({ a: false })).toBe(false);
    expect(anyDeckUpdates({ a: true })).toBe(true);
  });
});
