import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardSection } from "./CardSection";
import type { DeckItem, GetCardsRes, GetNextCardRes } from "@/lib/api";

const mockDeck: DeckItem = {
  id: "deck1",
  name: "Test Deck",
  owner: "user",
  fields: ["Front", "Back"],
  rate: 10,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  stats: {
    cards_count: 5,
    facts_count: 3,
    due_cards: 2,
    hidden_cards: 0,
    new_cards_today: 0,
    reviewed_cards: 1,
    unseen_cards: 4,
    last_reviewed_at: 0,
  },
};

function makeNextCard(overrides: Partial<GetNextCardRes["data"]> = {}): GetNextCardRes["data"] {
  const dueDate = Math.floor(Date.now() / 1000) + 3600;
  return {
    card: {
      id: "c1",
      fact_id: "f1",
      template: [[0], [1]],
      last_review: dueDate - 86400,
      due_date: dueDate,
      hidden: false,
      created_at: dueDate - 86400,
      front: [{ field: "Word", text: "Apple" }],
      back: [{ field: "Translation", text: "苹果" }],
    },
    urgency: 0.5,
    ...overrides,
  };
}

const defaultProps = {
  deck: mockDeck,
  cardStats: null as GetCardsRes["data"] | null,
  loadingCards: false,
  nextCardFact: null,
  loadingNextCard: false,
  cardError: "",
  cardSuccess: "",
  onUpdateCard: vi.fn(),
  onHideCard: vi.fn(),
};

describe("CardSection", () => {
  it("renders next card with entry text fields", () => {
    const nextCard = makeNextCard();
    render(
      <CardSection
        {...defaultProps}
        nextCard={nextCard}
      />
    );
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Click to flip")).toBeInTheDocument();
  });

  it("renders card when front has text and audio siblings", () => {
    const nextCard = makeNextCard({
      card: {
        id: "c2",
        fact_id: "f2",
        template: [[0], [1]],
        last_review: 0,
        due_date: 1000,
        hidden: false,
        created_at: 0,
        front: [{ field: "Q", text: "Question?", audio: "aud1" }],
        back: [{ field: "A", text: "Answer" }],
      },
      urgency: 1,
    });
    render(
      <CardSection
        {...defaultProps}
        nextCard={nextCard}
      />
    );
    expect(screen.getByText("Question?")).toBeInTheDocument();
    expect(screen.getByText("Click to flip")).toBeInTheDocument();
  });

  it("renders card with video item in front", () => {
    const nextCard = makeNextCard({
      card: {
        id: "c3",
        fact_id: "f3",
        template: [[0], [1]],
        last_review: 0,
        due_date: 2000,
        hidden: false,
        created_at: 0,
        front: [{ field: "Clip", video: "vid1" }],
        back: [{ field: "Caption", text: "Caption text" }],
      },
      urgency: 0.8,
    });
    render(
      <CardSection
        {...defaultProps}
        nextCard={nextCard}
      />
    );
    expect(screen.getByText("Click to flip")).toBeInTheDocument();
  });

  it("does not render card content when nextCard is null", () => {
    render(
      <CardSection
        {...defaultProps}
        nextCard={null}
      />
    );
    expect(screen.getByText("Cards")).toBeInTheDocument();
    expect(screen.queryByText("Click to flip")).not.toBeInTheDocument();
  });

  it("shows loading state when loading next card", () => {
    render(
      <CardSection
        {...defaultProps}
        nextCard={null}
        loadingNextCard={true}
      />
    );
    expect(screen.getByText("Loading next card…")).toBeInTheDocument();
  });
});
