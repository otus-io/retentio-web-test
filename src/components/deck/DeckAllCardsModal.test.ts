import { describe, it, expect } from "vitest";
import { categoryLabelForGetCardsRow, pickCardsForFilter, type GetCardsData } from "./DeckAllCardsModal";
import type { DeckCardListItem } from "@/lib/api";

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

function mockPayload(lists: Partial<GetCardsData>): GetCardsData {
  return {
    total_cards: 0,
    hidden_cards_count: 0,
    due_cards: 0,
    due_cards_list: [],
    unseen_cards: 0,
    hidden_cards_list: [],
    unseen_cards_list: [],
    seen_cards_list: [],
    cards: [],
    ...lists,
  };
}

describe("pickCardsForFilter", () => {
  it("returns full cards for all", () => {
    const data = mockPayload({ cards: [card("a"), card("b")] });
    expect(pickCardsForFilter(data, "all").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("returns each server list for its filter", () => {
    const data = mockPayload({
      cards: [card("a"), card("b"), card("h", { hidden: true })],
      hidden_cards_list: [card("h", { hidden: true })],
      unseen_cards_list: [card("u", { last_review: 10, due_date: 11 })],
      due_cards_list: [card("d", { last_review: 1, due_date: 5000 })],
      seen_cards_list: [card("s", { last_review: 1, due_date: 999_999 })],
    });
    expect(pickCardsForFilter(data, "Hidden").map((c) => c.id)).toEqual(["h"]);
    expect(pickCardsForFilter(data, "Unseen").map((c) => c.id)).toEqual(["u"]);
    expect(pickCardsForFilter(data, "Due").map((c) => c.id)).toEqual(["d"]);
    expect(pickCardsForFilter(data, "Seen").map((c) => c.id)).toEqual(["s"]);
  });

  it("uses empty arrays when server lists are undefined", () => {
    const data = {
      total_cards: 0,
      hidden_cards_count: 0,
      due_cards: 0,
      unseen_cards: 0,
      cards: [card("a")],
    } as GetCardsData;
    expect(pickCardsForFilter(data, "Hidden")).toEqual([]);
    expect(pickCardsForFilter(data, "Unseen")).toEqual([]);
    expect(pickCardsForFilter(data, "Due")).toEqual([]);
    expect(pickCardsForFilter(data, "Seen")).toEqual([]);
  });
});

describe("categoryLabelForGetCardsRow", () => {
  it("labels hidden from hidden_cards_list", () => {
    const h = card("h", { hidden: true });
    const data = mockPayload({
      hidden_cards_list: [h],
      unseen_cards_list: [],
      due_cards_list: [],
      seen_cards_list: [],
    });
    expect(categoryLabelForGetCardsRow(h, data)).toBe("Hidden");
  });

  it("combines Unseen and Due when card is in both lists", () => {
    const c = card("x", { last_review: 1000, due_date: 1001 });
    const data = mockPayload({
      unseen_cards_list: [c],
      due_cards_list: [c],
      seen_cards_list: [],
      hidden_cards_list: [],
    });
    expect(categoryLabelForGetCardsRow(c, data)).toBe("Unseen, Due");
  });

  it("returns Seen when only in seen_cards_list", () => {
    const c = card("s", { last_review: 100, due_date: 10_000 });
    const data = mockPayload({
      unseen_cards_list: [],
      due_cards_list: [],
      seen_cards_list: [c],
      hidden_cards_list: [],
    });
    expect(categoryLabelForGetCardsRow(c, data)).toBe("Seen");
  });

  it("returns Unseen when only in unseen_cards_list", () => {
    const c = card("u", { last_review: 0, due_date: 1 });
    const data = mockPayload({
      unseen_cards_list: [c],
      due_cards_list: [],
      seen_cards_list: [],
      hidden_cards_list: [],
    });
    expect(categoryLabelForGetCardsRow(c, data)).toBe("Unseen");
  });

  it("returns Due when only in due_cards_list", () => {
    const c = card("d", { last_review: 1, due_date: 2 });
    const data = mockPayload({
      unseen_cards_list: [],
      due_cards_list: [c],
      seen_cards_list: [],
      hidden_cards_list: [],
    });
    expect(categoryLabelForGetCardsRow(c, data)).toBe("Due");
  });

  it("returns em dash when card is not in any membership list", () => {
    const c = card("orphan");
    const data = mockPayload({
      cards: [c],
      unseen_cards_list: [],
      due_cards_list: [],
      seen_cards_list: [],
      hidden_cards_list: [],
    });
    expect(categoryLabelForGetCardsRow(c, data)).toBe("—");
  });
});
