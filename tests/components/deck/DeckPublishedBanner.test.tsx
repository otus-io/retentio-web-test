import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeckPublishedBanner } from "@/components/deck/DeckPublishedBanner";
import type { DeckItem } from "@/lib/api";

const baseDeck: DeckItem = {
  id: "deckabc12345",
  name: "Test",
  owner: "u1",
  fields: ["Front", "Back"],
  rate: 20,
  stats: {
    facts_count: 0,
    cards_count: 0,
    unseen_cards: 0,
    reviewed_cards: 0,
    due_cards: 0,
    hidden_cards: 0,
    new_cards_today: 0,
  },
  created_at: "1",
  updated_at: "1",
};

describe("DeckPublishedBanner", () => {
  it("renders nothing when never published", () => {
    const { container } = render(<DeckPublishedBanner deck={{ ...baseDeck, published_version: 0 }} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows Published status and version", () => {
    render(
      <DeckPublishedBanner
        deck={{ ...baseDeck, published_version: 2, visibility: "public" }}
      />
    );
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText(/deckabc12345/)).toBeInTheDocument();
  });
});
