import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeckProvenanceBanner } from "@/components/deck/DeckProvenanceBanner";
import type { DeckItem } from "@/lib/api";

const importDeck: DeckItem = {
  id: "imp1",
  name: "Imported",
  fields: ["English", "Japanese"],
  rate: 20,
  stats: {
    cards_count: 0,
    due_cards: 0,
    facts_count: 0,
    hidden_cards: 0,
    last_reviewed_at: 0,
    new_cards_today: 0,
    reviewed_cards: 0,
    unseen_cards: 0,
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  source_deck_id: "srcdeck01",
  source_version: 2,
};

describe("DeckProvenanceBanner", () => {
  it("shows source author when owner is present", () => {
    render(
      <DeckProvenanceBanner
        deck={{ ...importDeck, owner: "alice" }}
        updateAvailable={false}
        onReviewUpdate={vi.fn()}
      />
    );
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("omits author when owner is missing", () => {
    render(
      <DeckProvenanceBanner
        deck={{ ...importDeck, owner: undefined }}
        updateAvailable={false}
        onReviewUpdate={vi.fn()}
      />
    );
    expect(screen.getByText(/imported from/i)).toBeInTheDocument();
    expect(screen.queryByText(/by/i)).not.toBeInTheDocument();
  });
});
