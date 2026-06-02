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

describe("normalizeTagName", () => {
  it("trims, collapses spaces, lowercases", () => {
    expect(normalizeTagName("  GRE   Prep ")).toBe("gre prep");
  });
});

describe("DeckTagsPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTags.mockResolvedValue({
      data: {
        tags: [
          { id: "t1", name: "verb", description: "" },
          { id: "t2", name: "noun", description: "" },
        ],
      },
      meta: { msg: "ok" },
    });
  });

  it("loads tags and adds selection from search results", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DeckTagsPicker token="tok" selectedIds={[]} onSelectedIdsChange={onChange} />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "verb" }));
    expect(onChange).toHaveBeenCalledWith(["t1"]);
  });

  it("filters tags as the user types", async () => {
    const user = userEvent.setup();
    render(
      <DeckTagsPicker token="tok" selectedIds={[]} onSelectedIdsChange={vi.fn()} />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "noun");

    expect(screen.getByRole("option", { name: "noun" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "verb" })).not.toBeInTheDocument();
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
      data: { tags: [{ id: "t1", name: "verb", description: "" }] },
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
    await user.click(screen.getByRole("option", { name: "verb" }));
    await waitFor(() => expect(addTagToDeck).toHaveBeenCalledWith("deck1", "t1", "tok"));
    expect(onChange).toHaveBeenCalledWith(["t1"]);
  });

  it("Add selects existing tag by normalized name without creating", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DeckTagsPicker token="tok" selectedIds={[]} onSelectedIdsChange={onChange} />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());

    await user.type(screen.getByRole("combobox"), "  VERB ");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["t1"]));
    expect(mockCreateTag).not.toHaveBeenCalled();
  });
});
