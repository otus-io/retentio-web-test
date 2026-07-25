import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagNameSearchCombo } from "@/components/tags/TagNameSearchCombo";
import type { TagItem } from "@/lib/tags";

const tags: TagItem[] = [
  { id: "t1", name: "verb", description: "" },
  { id: "t2", name: "noun", description: "" },
];

describe("TagNameSearchCombo", () => {
  it("filters options as the user types", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const { rerender } = render(
      <TagNameSearchCombo
        query=""
        onQueryChange={onQueryChange}
        availableTags={tags}
        onPickTag={vi.fn()}
        onAddQuery={vi.fn()}
      />
    );

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "verb" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "noun" })).toBeInTheDocument();

    rerender(
      <TagNameSearchCombo
        query="ver"
        onQueryChange={onQueryChange}
        availableTags={tags}
        onPickTag={vi.fn()}
        onAddQuery={vi.fn()}
      />
    );
    expect(screen.getByRole("option", { name: "verb" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "noun" })).not.toBeInTheDocument();
  });

  it("calls onPickTag when an option is clicked", async () => {
    const user = userEvent.setup();
    const onPickTag = vi.fn();
    render(
      <TagNameSearchCombo
        query=""
        onQueryChange={vi.fn()}
        availableTags={tags}
        onPickTag={onPickTag}
        onAddQuery={vi.fn()}
      />
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "verb" }));
    expect(onPickTag).toHaveBeenCalledWith(tags[0]);
  });
});
