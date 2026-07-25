import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DeckInfoCard } from "@/components/deck/DeckInfoCard";
import type { DeckItem } from "@/lib/api";

vi.mock("@/lib/tags", () => ({
  getDeckTags: vi.fn(),
}));

import { getDeckTags, type TagItem } from "@/lib/tags";

const mockGetDeckTags = vi.mocked(getDeckTags);

const mockDeck: DeckItem = {
  id: "deck123",
  name: "My Vocab",
  owner: "alice",
  fields: ["English", "Chinese"],
  rate: 10,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  stats: {
    cards_count: 20,
    facts_count: 10,
    due_cards: 3,
    hidden_cards: 1,
    new_cards_today: 2,
    reviewed_cards: 5,
    unseen_cards: 15,
    last_reviewed_at: 0,
  },
};

function renderCard(overrides: Partial<Parameters<typeof DeckInfoCard>[0]> = {}) {
  const props = {
    deck: mockDeck,
    onEdit: vi.fn(),
    onBulkEditFacts: vi.fn(),
    deleteConfirm: false,
    onDeleteConfirm: vi.fn(),
    onDeleteCancel: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DeckInfoCard {...props} />
    </MemoryRouter>
  );
  return props;
}

describe("DeckInfoCard", () => {
  beforeEach(() => {
    mockGetDeckTags.mockReset();
    mockGetDeckTags.mockResolvedValue({ data: { tags: [] }, meta: { msg: "ok" } });
  });

  it("renders the deck name", () => {
    renderCard();
    expect(screen.getByText("My Vocab")).toBeInTheDocument();
  });

  it("renders the deck id", () => {
    renderCard();
    expect(screen.getByText(/deck123/)).toBeInTheDocument();
  });

  it("renders field names", () => {
    renderCard();
    expect(screen.getByText("English, Chinese")).toBeInTheDocument();
  });

  it("renders stats correctly", () => {
    renderCard();
    // facts_count: 10 and rate: 10 both render "10" — assert at least two occurrences
    expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("20")).toBeInTheDocument(); // cards_count
    expect(screen.getByText("15")).toBeInTheDocument(); // unseen_cards
  });

  it("calls onEdit when Edit Deck menu item is clicked", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderCard();
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /^edit deck$/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("does not show Change Font when onOpenCardFonts is omitted", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { expanded: false }));
    expect(screen.queryByRole("menuitem", { name: /^change font$/i })).not.toBeInTheDocument();
  });

  it("calls onOpenCardFonts when Change Font menu item is clicked", async () => {
    const user = userEvent.setup();
    const onOpenCardFonts = vi.fn();
    renderCard({ onOpenCardFonts });
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /^change font$/i }));
    expect(onOpenCardFonts).toHaveBeenCalledTimes(1);
  });

  it("does not show Add Facts when onOpenAddFacts is omitted", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { expanded: false }));
    expect(screen.queryByRole("menuitem", { name: /^add facts$/i })).not.toBeInTheDocument();
  });

  it("calls onOpenAddFacts when Add Facts menu item is clicked", async () => {
    const user = userEvent.setup();
    const onOpenAddFacts = vi.fn();
    renderCard({ onOpenAddFacts });
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /^add facts$/i }));
    expect(onOpenAddFacts).toHaveBeenCalledTimes(1);
  });

  it("does not show Get All Cards when onOpenAllCards is omitted", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { expanded: false }));
    expect(screen.queryByRole("menuitem", { name: /get all cards/i })).not.toBeInTheDocument();
  });

  it("calls onOpenAllCards when Get All Cards menu item is clicked", async () => {
    const user = userEvent.setup();
    const onOpenAllCards = vi.fn();
    renderCard({ onOpenAllCards });
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /get all cards/i }));
    expect(onOpenAllCards).toHaveBeenCalledTimes(1);
  });

  it("calls onBulkEditFacts when Edit Facts menu item is clicked", async () => {
    const user = userEvent.setup();
    const { onBulkEditFacts } = renderCard();
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /^edit facts$/i }));
    expect(onBulkEditFacts).toHaveBeenCalledTimes(1);
  });

  it("calls onDeleteConfirm when Delete deck menu item is clicked", async () => {
    const user = userEvent.setup();
    const { onDeleteConfirm } = renderCard();
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /delete deck/i }));
    expect(onDeleteConfirm).toHaveBeenCalledTimes(1);
  });

  it("hides Delete deck when deck is published", async () => {
    const user = userEvent.setup();
    renderCard({ deck: { ...mockDeck, published_version: 2, visibility: "public" } });
    await user.click(screen.getByRole("button", { expanded: false }));
    expect(screen.queryByRole("menuitem", { name: /delete deck/i })).not.toBeInTheDocument();
  });

  it("shows Publish for sharing when onPublish is provided", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();
    renderCard({ onPublish });
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /publish for sharing/i }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("hides fact edit menu items when factsEditable is false", async () => {
    const user = userEvent.setup();
    renderCard({ factsEditable: false, onOpenAddFacts: vi.fn() });
    await user.click(screen.getByRole("button", { expanded: false }));
    expect(screen.queryByRole("menuitem", { name: /^add facts$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^edit facts$/i })).not.toBeInTheDocument();
  });

  it("shows Imported badge for import decks", () => {
    renderCard({ deck: { ...mockDeck, source_deck_id: "src99", source_version: 1 } });
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });

  it("shows delete confirmation dialog when deleteConfirm is true", () => {
    renderCard({ deleteConfirm: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/delete deck\?/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent(/My Vocab/);
  });

  it("does not show dialog when deleteConfirm is false", () => {
    renderCard({ deleteConfirm: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onDelete when dialog Delete button is confirmed", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderCard({ deleteConfirm: true });
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("calls onDeleteCancel when dialog Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const { onDeleteCancel } = renderCard({ deleteConfirm: true });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onDeleteCancel).toHaveBeenCalledTimes(1);
  });

  it("does not render last review when last_reviewed_at is 0", () => {
    renderCard();
    expect(screen.queryByText(/last review/i)).not.toBeInTheDocument();
  });

  it("renders last review when last_reviewed_at is set", () => {
    const now = Math.floor(Date.now() / 1000);
    renderCard({ deck: { ...mockDeck, stats: { ...mockDeck.stats, last_reviewed_at: now - 30 } } });
    expect(screen.getByText(/last review/i)).toBeInTheDocument();
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("shows Author label and source owner for imported decks", () => {
    renderCard({
      deck: {
        ...mockDeck,
        owner: "alice",
        source_deck_id: "srcdeck01",
        source_version: 2,
        imported_at: "2024-06-01T00:00:00Z",
      },
    });
    const deckInfo = screen.getByText("Deck info").parentElement;
    expect(deckInfo).toHaveTextContent("Author:");
    expect(deckInfo).toHaveTextContent("alice");
    expect(deckInfo).not.toHaveTextContent("Owner:");
  });

  it("shows em dash for imported deck when source author is unknown", () => {
    renderCard({
      deck: {
        ...mockDeck,
        owner: undefined,
        source_deck_id: "srcdeck01",
        source_version: 2,
        imported_at: "2024-06-01T00:00:00Z",
      },
    });
    const deckInfo = screen.getByText("Deck info").parentElement;
    expect(deckInfo).toHaveTextContent("Author:");
    expect(deckInfo).toHaveTextContent("—");
  });

  it("shows deck info metadata including visibility and owner", () => {
    renderCard({ deck: { ...mockDeck, visibility: "private", published_version: 2 } });
    const deckInfo = screen.getByText("Deck info").parentElement;
    expect(deckInfo).toHaveTextContent("Visibility:");
    expect(deckInfo).toHaveTextContent("Private");
    expect(deckInfo).toHaveTextContent("Published:");
    expect(deckInfo).toHaveTextContent("v2");
    expect(deckInfo).toHaveTextContent("Owner:");
    expect(deckInfo).toHaveTextContent("alice");
  });

  it("renders deck tags from GET /api/decks/{id}/tags", async () => {
    mockGetDeckTags.mockResolvedValue({
      data: {
        tags: [
          { id: "t1", name: "JLPT", description: "" },
          { id: "t2", name: "verb", description: "POS" },
        ],
      },
      meta: { msg: "ok" },
    });
    renderCard({ token: "tok" });
    await waitFor(() => expect(screen.getByText("JLPT")).toBeInTheDocument());
    expect(screen.getByText("verb")).toBeInTheDocument();
    expect(mockGetDeckTags).toHaveBeenCalledWith("deck123", "tok");
  });

  it("handles null tags in API response without crashing", async () => {
    mockGetDeckTags.mockResolvedValue({
      data: { tags: null as unknown as TagItem[] },
      meta: { msg: "ok" },
    });
    renderCard({ token: "tok" });
    await waitFor(() => {
      const tagsDt = screen.getByText("Tags");
      expect(tagsDt.parentElement?.querySelector("dd")).toHaveTextContent("—");
    });
  });

  it("shows em dash when deck has no tags", async () => {
    renderCard({ token: "tok" });
    await waitFor(() => {
      const tagsDt = screen.getByText("Tags");
      expect(tagsDt.parentElement?.querySelector("dd")).toHaveTextContent("—");
    });
  });

  it("shows import provenance in deck info", () => {
    renderCard({
      deck: {
        ...mockDeck,
        source_deck_id: "srcdeck99",
        source_version: 3,
        imported_at: "2025-06-01T12:00:00Z",
      },
    });
    expect(screen.getByText(/imported copy/i)).toBeInTheDocument();
    expect(screen.getByText(/source deck:/i)).toBeInTheDocument();
    expect(screen.getByText("srcdeck99")).toBeInTheDocument();
    expect(screen.getByText(/pinned to source v3/i)).toBeInTheDocument();
  });
});
