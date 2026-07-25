import { describe, it, expect } from "vitest";
import {
  buildGetAllCardsPath,
  categoryLabelForGetCardsRow,
  pickCardsForFilter,
  type GetCardsData,
} from "@/components/deck/DeckAllCardsModal";
import type { DeckCardListItem, DeckStats } from "@/lib/api";

function card(id: string, p: Partial<DeckCardListItem> = {}): DeckCardListItem {
  return {
    id,
    fact_id: "f1",
    template: [[0], [1]],
    last_review: 1000,
    due_date: 2000,
    hidden: false,
    created_at: 900,
    ...p,
  };
}

function emptyStats(overrides: Partial<DeckStats> = {}): DeckStats {
  return {
    cards_count: 0,
    facts_count: 0,
    unseen_cards: 0,
    reviewed_cards: 0,
    due_cards: 0,
    hidden_cards: 0,
    new_cards_today: 0,
    last_reviewed_at: 0,
    ...overrides,
  };
}

function mockPayload(cards: DeckCardListItem[], stats?: Partial<DeckStats>): GetCardsData {
  return {
    stats: emptyStats({ cards_count: cards.length, ...stats }),
    cards,
  };
}

describe("pickCardsForFilter", () => {
  it("returns full cards for all", () => {
    const data = mockPayload([card("a"), card("b")], { cards_count: 2 });
    expect(pickCardsForFilter(data, "all").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("returns each bucket for its filter", () => {
    const now = Math.floor(Date.now() / 1000);
    const data = mockPayload(
      [
        card("h", { hidden: true }),
        card("u", { last_review: now - 1, due_date: now }),
        card("d", { last_review: 1, due_date: now }),
        card("s", { last_review: 1, due_date: now + 10_000 }),
      ],
      { cards_count: 4 }
    );
    expect(pickCardsForFilter(data, "Hidden").map((c) => c.id)).toEqual(["h"]);
    expect(pickCardsForFilter(data, "Unseen").map((c) => c.id)).toEqual(["u"]);
    expect(pickCardsForFilter(data, "Due").map((c) => c.id)).toEqual(["u", "d"]);
    expect(pickCardsForFilter(data, "Seen").map((c) => c.id)).toEqual(["s"]);
  });

  it("returns empty arrays when cards is empty", () => {
    const data = mockPayload([]);
    expect(pickCardsForFilter(data, "Hidden")).toEqual([]);
    expect(pickCardsForFilter(data, "Unseen")).toEqual([]);
    expect(pickCardsForFilter(data, "Due")).toEqual([]);
    expect(pickCardsForFilter(data, "Seen")).toEqual([]);
  });
});

describe("buildGetAllCardsPath", () => {
  it("returns base cards path when tag_id is blank", () => {
    expect(buildGetAllCardsPath("deck-1", "   ")).toBe("/api/decks/deck-1/cards");
  });

  it("adds encoded tag_id query when provided", () => {
    expect(buildGetAllCardsPath("deck-1", "Kt8QmNz2")).toBe("/api/decks/deck-1/cards?tag_id=Kt8QmNz2");
    expect(buildGetAllCardsPath("deck 1", "tag with space")).toBe(
      "/api/decks/deck%201/cards?tag_id=tag%20with%20space"
    );
  });
});

describe("categoryLabelForGetCardsRow", () => {
  it("labels hidden cards", () => {
    const h = card("h", { hidden: true });
    const data = mockPayload([h]);
    expect(categoryLabelForGetCardsRow(h, data)).toBe("Hidden");
  });

  it("combines Unseen and Due when card matches both", () => {
    const now = Math.floor(Date.now() / 1000);
    const c = card("x", { last_review: now - 1, due_date: now });
    const data = mockPayload([c]);
    expect(categoryLabelForGetCardsRow(c, data)).toBe("Unseen, Due");
  });

  it("returns Seen for reviewed card not yet due", () => {
    const now = Math.floor(Date.now() / 1000);
    const c = card("s", { last_review: now - 500, due_date: now + 10_000 });
    const data = mockPayload([c]);
    expect(categoryLabelForGetCardsRow(c, data)).toBe("Seen");
  });

  it("returns Unseen when only unseen", () => {
    const now = Math.floor(Date.now() / 1000);
    const c = card("u", { last_review: now, due_date: now + 1 });
    const data = mockPayload([c]);
    expect(categoryLabelForGetCardsRow(c, data)).toBe("Unseen");
  });

  it("returns Due when only due", () => {
    const now = Math.floor(Date.now() / 1000);
    const c = card("d", { last_review: 1, due_date: now });
    const data = mockPayload([c]);
    expect(categoryLabelForGetCardsRow(c, data)).toBe("Due");
  });
});
