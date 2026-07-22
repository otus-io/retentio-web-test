import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardSection } from "./CardSection";
import type { DeckItem, FactItem, GetNextCardRes } from "@/lib/api";

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

  it("renders wiki-style [[main|reading]] markup as HTML ruby on card text", () => {
    const base = makeNextCard();
    const nextCard = {
      ...base,
      card: {
        ...base.card,
        front: [{ field: "Word", text: "[[皆|みな]]さん" }],
      },
    };
    render(<CardSection {...defaultProps} nextCard={nextCard} />);
    expect(screen.getByText("皆")).toBeInTheDocument();
    expect(screen.getByText("みな")).toBeInTheDocument();
    expect(screen.getByText("さん")).toBeInTheDocument();
    const ruby = document.querySelector("ruby");
    expect(ruby).toBeTruthy();
    expect(ruby?.querySelector("rt")).toHaveTextContent("みな");
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

  it("shows study stats and reviewed/total progress percentage", () => {
    render(
      <CardSection
        {...defaultProps}
        nextCard={null}
        tagFilterStats={{ cardsCount: 12, dueCards: 3, reviewedCards: 9 }}
      />
    );
    expect(screen.getByText("Cards")).toBeInTheDocument();
    expect(screen.getByText("Total 12 · Overdue 3")).toBeInTheDocument();
    expect(screen.getByText("9 / 12 reviewed")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: /reviewed cards progress/i });
    expect(bar).toHaveAttribute("aria-valuenow", "9");
    expect(bar).toHaveAttribute("aria-valuemax", "12");
  });

  it("does not show study stats when not provided", () => {
    render(
      <CardSection
        {...defaultProps}
        nextCard={null}
      />
    );
    expect(screen.queryByText(/Total \d+/)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("after edit save with onOfferSendEditToAuthor, shows send-to-author notice", async () => {
    const user = userEvent.setup();
    const onSaveFact = vi.fn().mockResolvedValue(undefined);
    const onOfferSendEditToAuthor = vi.fn();
    const fact: FactItem = {
      id: "f1",
      entries: [{ text: "Apple" }, { text: "苹果" }],
    };
    render(
      <CardSection
        {...defaultProps}
        nextCard={makeNextCard()}
        nextCardFact={fact}
        onSaveFact={onSaveFact}
        onOfferSendEditToAuthor={onOfferSendEditToAuthor}
      />
    );

    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /^edit$/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSaveFact).toHaveBeenCalled();
    expect(screen.getByText(/saved privately/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /send to author/i }));
    expect(onOfferSendEditToAuthor).toHaveBeenCalledWith("f1");
    expect(screen.queryByText(/saved privately/i)).not.toBeInTheDocument();
  });
});
