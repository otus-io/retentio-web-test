import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeckTagsPicker, normalizeTagName } from "./DeckTagsPicker";

vi.mock("@/lib/tags", () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
  addTagToDeck: vi.fn(),
  removeTagFromDeck: vi.fn(),
}));

import { listTags, createTag } from "@/lib/tags";

const mockListTags = vi.mocked(listTags);
const mockCreateTag = vi.mocked(createTag);

const deckOnlyTags = {
  data: {
    tags: [
      { id: "d1", name: "IELTS", description: "" },
      { id: "d2", name: "vocabulary", description: "" },
    ],
  },
  meta: { msg: "ok" },
};

describe("normalizeTagName", () => {
  it("trims, collapses spaces, lowercases", () => {
    expect(normalizeTagName("  GRE   Prep ")).toBe("gre prep");
  });
});

describe("DeckTagsPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTags.mockResolvedValue(deckOnlyTags);
  });

  it("loads deck-scoped tags via used_on=deck", async () => {
    render(
      <DeckTagsPicker token="tok" selectedIds={[]} onSelectedIdsChange={vi.fn()} />
    );

    await waitFor(() =>
      expect(mockListTags).toHaveBeenCalledWith("tok", { usedOn: "deck", deckId: undefined })
    );
  });

  it("passes deckId when editing an existing deck", async () => {
    render(
      <DeckTagsPicker
        token="tok"
        deckId="deck1"
        selectedIds={[]}
        onSelectedIdsChange={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(mockListTags).toHaveBeenCalledWith("tok", { usedOn: "deck", deckId: "deck1" })
    );
  });

  it("shows only tags returned by the deck picker API", async () => {
    const user = userEvent.setup();
    render(
      <DeckTagsPicker token="tok" selectedIds={[]} onSelectedIdsChange={vi.fn()} />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "IELTS" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "vocabulary" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "verb" })).not.toBeInTheDocument();
  });

  it("loads tags and adds selection from search results", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DeckTagsPicker token="tok" selectedIds={[]} onSelectedIdsChange={onChange} />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "IELTS" }));
    expect(onChange).toHaveBeenCalledWith(["d1"]);
  });

  it("filters tags as the user types", async () => {
    const user = userEvent.setup();
    render(
      <DeckTagsPicker token="tok" selectedIds={[]} onSelectedIdsChange={vi.fn()} />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "vocab");

    expect(screen.getByRole("option", { name: "vocabulary" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "IELTS" })).not.toBeInTheDocument();
  });

  it("Add creates a new tag and selects it", async () => {
    const user = userEvent.setup();
    mockCreateTag.mockResolvedValue({
      data: { tag: { id: "t9", name: "newtag", description: "" } },
      meta: { msg: "ok" },
    });
    const onChange = vi.fn();
    render(
      <DeckTagsPicker token="tok" selectedIds={[]} onSelectedIdsChange={onChange} />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());

    await user.type(screen.getByRole("combobox"), "newtag");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(mockCreateTag).toHaveBeenCalledWith({ name: "newtag" }, "tok"));
    expect(onChange).toHaveBeenCalledWith(["t9"]);
  });

  it("edit mode persists add via addTagToDeck", async () => {
    const { addTagToDeck } = await import("@/lib/tags");
    vi.mocked(addTagToDeck).mockResolvedValue({
      data: { tags: [{ id: "d1", name: "IELTS", description: "" }] },
      meta: { msg: "ok" },
    });
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DeckTagsPicker
        token="tok"
        deckId="deck1"
        selectedIds={[]}
        onSelectedIdsChange={onChange}
      />
    );
    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "IELTS" }));
    await waitFor(() => expect(addTagToDeck).toHaveBeenCalledWith("deck1", "d1", "tok"));
    expect(onChange).toHaveBeenCalledWith(["d1"]);
  });

  it("Add selects existing tag by normalized name without creating", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DeckTagsPicker token="tok" selectedIds={[]} onSelectedIdsChange={onChange} />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());

    await user.type(screen.getByRole("combobox"), "  IELTS ");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["d1"]));
    expect(mockCreateTag).not.toHaveBeenCalled();
  });
});
