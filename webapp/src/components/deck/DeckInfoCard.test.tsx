import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DeckInfoCard } from "./DeckInfoCard";
import type { DeckItem } from "@/lib/api";

const mockDeck: DeckItem = {
  id: "deck123",
  name: "My Vocab",
  owner: "alice",
  field: ["English", "Chinese"],
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
    deleteConfirm: false,
    onDeleteConfirm: vi.fn(),
    onDeleteCancel: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <DeckInfoCard {...props} />
    </MemoryRouter>
  );
  return props;
}

describe("DeckInfoCard", () => {
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

  it("links Bulk Upload to this deck", () => {
    renderCard();
    const link = screen.getByRole("link", { name: /Bulk Upload \(ZIP\)/i });
    expect(link).toHaveAttribute("href", "/decks/deck123/bulk-upload");
  });

  it("calls onEdit when Edit menu item is clicked", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderCard();
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onDeleteConfirm when Delete deck menu item is clicked", async () => {
    const user = userEvent.setup();
    const { onDeleteConfirm } = renderCard();
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /delete deck/i }));
    expect(onDeleteConfirm).toHaveBeenCalledTimes(1);
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
});
