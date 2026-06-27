import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FactTagsPicker } from "./FactTagsPicker";

vi.mock("@/lib/tags", () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
  addTagToFact: vi.fn(),
  removeTagFromFact: vi.fn(),
}));

import { listTags, createTag } from "@/lib/tags";

const mockListTags = vi.mocked(listTags);
const mockCreateTag = vi.mocked(createTag);

const factOnlyTags = {
  data: {
    tags: [
      { id: "f1", name: "verb", description: "" },
      { id: "f2", name: "noun", description: "" },
    ],
  },
  meta: { msg: "ok" },
};

describe("FactTagsPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTags.mockResolvedValue(factOnlyTags);
  });

  it("loads fact-scoped tags via used_on=fact and deckId", async () => {
    render(
      <FactTagsPicker
        token="tok"
        deckId="deck1"
        selectedIds={[]}
        onSelectedIdsChange={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(mockListTags).toHaveBeenCalledWith("tok", { usedOn: "fact", deckId: "deck1" })
    );
  });

  it("shows only tags returned by the fact picker API", async () => {
    const user = userEvent.setup();
    render(
      <FactTagsPicker
        token="tok"
        deckId="deck1"
        selectedIds={[]}
        onSelectedIdsChange={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "verb" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "noun" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "IELTS" })).not.toBeInTheDocument();
  });

  it("loads tags and adds selection from search results", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FactTagsPicker
        token="tok"
        deckId="deck1"
        selectedIds={[]}
        onSelectedIdsChange={onChange}
      />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "verb" }));
    expect(onChange).toHaveBeenCalledWith(["f1"]);
  });

  it("Add creates a new tag and selects it", async () => {
    const user = userEvent.setup();
    mockCreateTag.mockResolvedValue({
      data: { tag: { id: "t9", name: "newtag", description: "" } },
      meta: { msg: "ok" },
    });
    const onChange = vi.fn();
    render(
      <FactTagsPicker
        token="tok"
        deckId="deck1"
        selectedIds={[]}
        onSelectedIdsChange={onChange}
      />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());

    await user.type(screen.getByRole("combobox"), "newtag");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(mockCreateTag).toHaveBeenCalledWith({ name: "newtag" }, "tok"));
    expect(onChange).toHaveBeenCalledWith(["t9"]);
  });

  it("edit mode persists add via addTagToFact", async () => {
    const { addTagToFact } = await import("@/lib/tags");
    vi.mocked(addTagToFact).mockResolvedValue({
      data: { tags: [{ id: "f1", name: "verb", description: "" }] },
      meta: { msg: "ok" },
    });
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FactTagsPicker
        token="tok"
        deckId="deck1"
        factId="fact1"
        selectedIds={[]}
        onSelectedIdsChange={onChange}
      />
    );
    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "verb" }));
    await waitFor(() => expect(addTagToFact).toHaveBeenCalledWith("deck1", "fact1", "f1", "tok"));
    expect(onChange).toHaveBeenCalledWith(["f1"]);
  });

  it("Add selects existing tag by normalized name without creating", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FactTagsPicker
        token="tok"
        deckId="deck1"
        selectedIds={[]}
        onSelectedIdsChange={onChange}
      />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());

    await user.type(screen.getByRole("combobox"), "  VERB ");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["f1"]));
    expect(mockCreateTag).not.toHaveBeenCalled();
  });

  it("shows tag names from tagItems before global list loads", async () => {
    mockListTags.mockImplementation(
      () => new Promise(() => {
        /* never resolves */
      })
    );
    render(
      <FactTagsPicker
        token="tok"
        deckId="deck1"
        selectedIds={["f1"]}
        onSelectedIdsChange={vi.fn()}
        tagItems={[{ id: "f1", name: "verb", description: "" }]}
        compact
      />
    );
    expect(screen.getByText("verb")).toBeInTheDocument();
  });
});
