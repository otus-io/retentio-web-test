import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FactsList } from "./FactsList";
import type { DeckItem, Entry, FactItem } from "@/lib/api";

const mockDeck: DeckItem = {
  id: "d1",
  name: "Vocab",
  owner: "alice",
  field: ["English", "Chinese"],
  rate: 10,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  stats: {
    cards_count: 6,
    facts_count: 3,
    due_cards: 0,
    hidden_cards: 0,
    new_cards_today: 0,
    reviewed_cards: 0,
    unseen_cards: 0,
  },
};

function makeFacts(n: number): FactItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `fact${i + 1}`,
    entries: [{ text: `Word${i + 1}` }, { text: `译${i + 1}` }],
  }));
}

const defaultProps = {
  deck: mockDeck,
  loadingFacts: false,
  factError: "",
  factSuccess: "",
  editingFactId: null,
  editingFactEntries: [] as Entry[],
  editingFactSplit: 1,
  setEditingFactId: vi.fn(),
  setEditingFactEntries: vi.fn(),
  setEditingFactSplit: vi.fn(),
  setFactError: vi.fn(),
  onUpdateFact: vi.fn((e: React.FormEvent) => e.preventDefault()),
  onDeleteFact: vi.fn(),
  deleteFactId: null,
  setDeleteFactId: vi.fn(),
};

function renderList(factsList: FactItem[], overrides = {}) {
  return render(<FactsList {...defaultProps} factsList={factsList} {...overrides} />);
}

describe("FactsList", () => {
  it("shows loading message when loadingFacts is true", () => {
    renderList([], { loadingFacts: true });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows empty state when there are no facts", () => {
    renderList([]);
    expect(screen.getByText(/no facts yet/i)).toBeInTheDocument();
  });

  it("renders fact entries as text", () => {
    renderList(makeFacts(2));
    expect(screen.getByText(/Word1/)).toBeInTheDocument();
    expect(screen.getByText(/Word2/)).toBeInTheDocument();
  });

  it("shows total fact count", () => {
    renderList(makeFacts(3));
    expect(screen.getByText("3 facts")).toBeInTheDocument();
  });

  it("shows factSuccess message", () => {
    renderList(makeFacts(1), { factSuccess: "Fact updated." });
    expect(screen.getByText("Fact updated.")).toBeInTheDocument();
  });

  it("shows factError message", () => {
    renderList(makeFacts(1), { factError: "Something went wrong" });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls setEditingFactId and setEditingFactEntries when Edit is clicked", async () => {
    const user = userEvent.setup();
    const setEditingFactId = vi.fn();
    const setEditingFactEntries = vi.fn();
    renderList(makeFacts(1), { setEditingFactId, setEditingFactEntries });
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    expect(setEditingFactId).toHaveBeenCalledWith("fact1");
    expect(setEditingFactEntries).toHaveBeenCalledWith([{ text: "Word1" }, { text: "译1" }]);
  });

  it("calls setDeleteFactId when Delete is clicked from the menu", async () => {
    const user = userEvent.setup();
    const setDeleteFactId = vi.fn();
    renderList(makeFacts(1), { setDeleteFactId });
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));
    expect(setDeleteFactId).toHaveBeenCalledWith("fact1");
  });

  it("shows delete confirmation dialog when deleteFactId is set", () => {
    renderList(makeFacts(1), { deleteFactId: "fact1" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/delete fact/i)).toBeInTheDocument();
  });

  it("calls onDeleteFact when dialog Delete is confirmed", async () => {
    const user = userEvent.setup();
    const onDeleteFact = vi.fn();
    renderList(makeFacts(1), { deleteFactId: "fact1", onDeleteFact });
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onDeleteFact).toHaveBeenCalledWith("fact1");
  });

  it("calls setDeleteFactId(null) when dialog Cancel is clicked", async () => {
    const user = userEvent.setup();
    const setDeleteFactId = vi.fn();
    renderList(makeFacts(1), { deleteFactId: "fact1", setDeleteFactId });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(setDeleteFactId).toHaveBeenCalledWith(null);
  });

  it("renders edit form with field values when editingFactId matches", () => {
    renderList(makeFacts(1), {
      editingFactId: "fact1",
      editingFactEntries: [{ text: "Word1" }, { text: "译1" }],
    });
    expect(screen.getByDisplayValue("Word1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("译1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls setEditingFactId(null) when edit form Cancel is clicked", async () => {
    const user = userEvent.setup();
    const setEditingFactId = vi.fn();
    renderList(makeFacts(1), {
      editingFactId: "fact1",
      editingFactEntries: [{ text: "Word1" }, { text: "译1" }],
      setEditingFactId,
    });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(setEditingFactId).toHaveBeenCalledWith(null);
  });

  it("calls onUpdateFact when edit form Save is submitted", async () => {
    const user = userEvent.setup();
    const onUpdateFact = vi.fn((e: React.FormEvent) => e.preventDefault());
    renderList(makeFacts(1), {
      editingFactId: "fact1",
      editingFactEntries: [{ text: "Word1" }, { text: "译1" }],
      onUpdateFact,
    });
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onUpdateFact).toHaveBeenCalledTimes(1);
  });

  describe("pagination", () => {
    it("shows only the first 5 facts on page 1", () => {
      renderList(makeFacts(7));
      expect(screen.getByText(/Word1/)).toBeInTheDocument();
      expect(screen.getByText(/Word5/)).toBeInTheDocument();
      expect(screen.queryByText(/Word6/)).not.toBeInTheDocument();
    });

    it("renders pagination controls when there are more than 5 facts", () => {
      renderList(makeFacts(6));
      expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
      expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    });

    it("does not render pagination when there are 5 or fewer facts", () => {
      renderList(makeFacts(5));
      expect(screen.queryByRole("button", { name: /previous/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    });

    it("navigates to the next page when Next is clicked", async () => {
      const user = userEvent.setup();
      renderList(makeFacts(7));
      await user.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Word6/)).toBeInTheDocument();
      expect(screen.queryByText(/Word1/)).not.toBeInTheDocument();
    });

    it("Previous is disabled on page 1", () => {
      renderList(makeFacts(6));
      expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    });

    it("Next is disabled on the last page", async () => {
      const user = userEvent.setup();
      renderList(makeFacts(6));
      await user.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });
  });

  it("formats media entries as plain text in the list", () => {
    const facts: FactItem[] = [
      { id: "f1", entries: [{ audio: "abc123" }, { text: "Hello" }] },
    ];
    renderList(facts);
    expect(screen.getByText(/audio:abc123/)).toBeInTheDocument();
  });
});
