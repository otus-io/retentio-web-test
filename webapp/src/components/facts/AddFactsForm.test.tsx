import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddFactsForm, makeInitialFactRow, type FactCell } from "./AddFactsForm";
import type { DeckItem } from "@/lib/api";

const mockDeck: DeckItem = {
  id: "d1",
  name: "Vocab",
  owner: "alice",
  field: ["English", "Chinese"],
  rate: 10,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  stats: {
    cards_count: 0, facts_count: 0, due_cards: 0,
    hidden_cards: 0, new_cards_today: 0, reviewed_cards: 0, unseen_cards: 0,
  },
};

function factRowFromValues(values: string[]): FactCell[] {
  const fields = mockDeck.field ?? [];
  return values.map((value, i) => ({
    type: "text" as const,
    value,
    label: fields[i] ?? `Field ${i + 1}`,
  }));
}

function renderForm(overrides: Partial<Parameters<typeof AddFactsForm>[0]> = {}) {
  const defaultFactRow = makeInitialFactRow(mockDeck);
  const props = {
    deck: mockDeck,
    factRow: defaultFactRow,
    setFactRow: vi.fn(),
    addFactOp: "append" as const,
    setAddFactOp: vi.fn(),
    addFactSplit: 1,
    setAddFactSplit: vi.fn(),
    sibling: false,
    setSibling: vi.fn(),
    addingFacts: false,
    addFactsError: "",
    onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    ...overrides,
  };
  render(<AddFactsForm {...props} />);
  return props;
}

describe("AddFactsForm", () => {
  it("renders the Add facts heading", () => {
    renderForm();
    expect(screen.getByText("Add facts", { selector: "p" })).toBeInTheDocument();
  });

  it("renders one Value input per factRow text cell", () => {
    renderForm({ factRow: factRowFromValues(["Hello", "你好"]) });
    const inputs = screen.getAllByPlaceholderText("Value");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue("Hello");
    expect(inputs[1]).toHaveValue("你好");
  });

  it("renders deck field names as labels", () => {
    renderForm();
    expect(screen.getAllByText("English").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Chinese").length).toBeGreaterThanOrEqual(1);
  });

  it("calls setFactRow when a field value is typed", async () => {
    const user = userEvent.setup();
    const { setFactRow } = renderForm();
    const [first] = screen.getAllByPlaceholderText("Value");
    await user.type(first, "A");
    expect(setFactRow).toHaveBeenCalled();
    const calls = (setFactRow as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1]?.[0] as FactCell[] | undefined;
    expect(lastCall).toBeDefined();
    expect(lastCall!.length).toBe(2);
    expect(lastCall![0].type === "text" && lastCall![0].value).toBe("A");
  });

  it("Add field button calls setFactRow with one more text cell", async () => {
    const user = userEvent.setup();
    const { setFactRow } = renderForm();
    await user.click(screen.getByRole("button", { name: /add field/i }));
    expect(setFactRow).toHaveBeenCalled();
    const calls = (setFactRow as ReturnType<typeof vi.fn>).mock.calls;
    const lastRow = calls[calls.length - 1]?.[0] as FactCell[];
    expect(lastRow).toHaveLength(3);
    expect(lastRow.every((c) => c.type === "text")).toBe(true);
  });

  it("Remove field button calls setFactRow with that cell removed", async () => {
    const user = userEvent.setup();
    const { setFactRow } = renderForm({ factRow: factRowFromValues(["Hello", "你好"]) });
    const removeButtons = screen.getAllByRole("button", { name: /remove field/i });
    await user.click(removeButtons[0]);
    expect(setFactRow).toHaveBeenCalled();
    const calls = (setFactRow as ReturnType<typeof vi.fn>).mock.calls;
    const lastRow = calls[calls.length - 1]?.[0] as FactCell[];
    expect(lastRow).toHaveLength(1);
    expect(lastRow[0].type === "text" && lastRow[0].value).toBe("你好");
  });

  it("disables the Add facts submit button when all fields are empty", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /add facts/i })).toBeDisabled();
  });

  it("enables the Add facts submit button when at least one field has a value", () => {
    renderForm({ factRow: factRowFromValues(["Hello", ""]) });
    expect(screen.getByRole("button", { name: /add facts/i })).not.toBeDisabled();
  });

  it("calls onSubmit when Add facts is clicked with a non-empty value", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ factRow: factRowFromValues(["Hello", "你好"]) });
    await user.click(screen.getByRole("button", { name: /add facts/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows addFactsError when provided", () => {
    renderForm({ addFactsError: "At least one fact is required." });
    expect(screen.getByText("At least one fact is required.")).toBeInTheDocument();
  });

  it("disables all inputs and buttons while addingFacts is true", () => {
    renderForm({ factRow: factRowFromValues(["Hello", "你好"]), addingFacts: true });
    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
    for (const input of screen.getAllByPlaceholderText("Value")) {
      expect(input).toBeDisabled();
    }
  });

  it("shows Adding… text on submit button when addingFacts is true", () => {
    renderForm({ factRow: factRowFromValues(["Hello", "你好"]), addingFacts: true });
    expect(screen.getByRole("button", { name: /adding…/i })).toBeInTheDocument();
  });

  it("renders the operation select with Append selected by default", () => {
    renderForm();
    expect(screen.getByRole("combobox")).toHaveValue("append");
  });

  it("calls setAddFactOp when a different operation is selected", async () => {
    const user = userEvent.setup();
    const { setAddFactOp } = renderForm();
    await user.selectOptions(screen.getByRole("combobox"), "spread");
    expect(setAddFactOp).toHaveBeenCalledWith("spread");
  });

  it("all four operations are available in the select", () => {
    renderForm();
    const options = screen.getAllByRole("option");
    const values = options.map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(["append", "prepend", "shuffle", "spread"]);
  });

  it("sibling checkbox is unchecked by default", () => {
    renderForm();
    expect(screen.getByRole("checkbox", { name: /sibling/i })).not.toBeChecked();
  });

  it("calls setSibling when sibling checkbox is toggled", async () => {
    const user = userEvent.setup();
    const { setSibling } = renderForm();
    await user.click(screen.getByRole("checkbox", { name: /sibling/i }));
    expect(setSibling).toHaveBeenCalledWith(true);
  });

  it("renders the Add media button", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /add media/i })).toBeInTheDocument();
  });

  it("Add media button is disabled once 2 media cells are in the row", () => {
    const file1 = new File(["a"], "a.mp3", { type: "audio/mpeg" });
    const file2 = new File(["b"], "b.png", { type: "image/png" });
    const row: FactCell[] = [
      ...factRowFromValues(["", ""]),
      { type: "media", entry: { file: file1, type: "audio", fieldName: "audio" } },
      { type: "media", entry: { file: file2, type: "image", fieldName: "img" } },
    ];
    renderForm({ factRow: row });
    expect(screen.getByRole("button", { name: /add media/i })).toBeDisabled();
  });

  it("renders attached media with type label and name in the row", () => {
    const file = new File(["data"], "sound.mp3", { type: "audio/mpeg" });
    const row: FactCell[] = [
      ...factRowFromValues(["", ""]),
      { type: "media", entry: { file, type: "audio", fieldName: "audio" } },
    ];
    renderForm({ factRow: row });
    expect(screen.getByText("Audio")).toBeInTheDocument();
    expect(screen.getByText("sound.mp3")).toBeInTheDocument();
    expect(screen.getByDisplayValue("audio")).toBeInTheDocument();
  });

  it("calls setFactRow with media cell removed when Remove is clicked", async () => {
    const user = userEvent.setup();
    const file = new File(["data"], "sound.mp3", { type: "audio/mpeg" });
    const row: FactCell[] = [
      ...factRowFromValues(["", ""]),
      { type: "media", entry: { file, type: "audio", fieldName: "audio" } },
    ];
    const { setFactRow } = renderForm({ factRow: row });
    const removeButtons = screen.getAllByRole("button", { name: /remove field/i });
    await user.click(removeButtons[removeButtons.length - 1]);
    expect(setFactRow).toHaveBeenCalled();
    const calls = (setFactRow as ReturnType<typeof vi.fn>).mock.calls;
    const lastRow = calls[calls.length - 1]?.[0] as FactCell[];
    expect(lastRow.some((c) => c.type === "media")).toBe(false);
  });

  it("renders Front and Back section labels when there are 2+ cells", () => {
    renderForm({ addFactSplit: 1 });
    expect(screen.getByRole("button", { name: /collapse front/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse back/i })).toBeInTheDocument();
  });

  describe("template display (cut line)", () => {
    it("shows default template when split is 1 and sibling unchecked", () => {
      renderForm({ factRow: factRowFromValues(["a", "b"]), addFactSplit: 1, sibling: false });
      expect(screen.getByTestId("add-facts-template")).toHaveTextContent(
        "default (0 front, rest back)"
      );
    });

    it("shows two templates when sibling checked and split 1", () => {
      renderForm({ factRow: factRowFromValues(["a", "b"]), addFactSplit: 1, sibling: true });
      expect(screen.getByTestId("add-facts-template")).toHaveTextContent(
        "[[[0],[1]],[[1],[0]]]"
      );
    });

    it("shows single template with custom split when sibling unchecked", () => {
      renderForm({ factRow: factRowFromValues(["a", "b", "c"]), addFactSplit: 2, sibling: false });
      expect(screen.getByTestId("add-facts-template")).toHaveTextContent(
        "[[[0,1],[2]]]"
      );
    });

    it("shows two templates with custom split when sibling checked", () => {
      renderForm({ factRow: factRowFromValues(["a", "b", "c"]), addFactSplit: 2, sibling: true });
      expect(screen.getByTestId("add-facts-template")).toHaveTextContent(
        "[[[0,1],[2]],[[2],[0,1]]]"
      );
    });

    it("shows front-only template when split equals field count", () => {
      renderForm({ factRow: factRowFromValues(["a", "b", "c"]), addFactSplit: 3, sibling: false });
      expect(screen.getByTestId("add-facts-template")).toHaveTextContent(
        "[[[0,1,2],[]]]"
      );
    });

    it("updates template when addFactSplit (cut line) changes", () => {
      const initialRow = factRowFromValues(["a", "b", "c"]);
      const setFactRow = vi.fn();
      const { rerender } = render(
        <AddFactsForm
          deck={mockDeck}
          factRow={initialRow}
          setFactRow={setFactRow}
          addFactOp="append"
          setAddFactOp={vi.fn()}
          addFactSplit={1}
          setAddFactSplit={vi.fn()}
          sibling={false}
          setSibling={vi.fn()}
          addingFacts={false}
          addFactsError=""
          onSubmit={vi.fn((e: React.FormEvent) => e.preventDefault())}
        />
      );
      expect(screen.getByTestId("add-facts-template")).toHaveTextContent(
        "default (0 front, rest back)"
      );

      rerender(
        <AddFactsForm
          deck={mockDeck}
          factRow={initialRow}
          setFactRow={setFactRow}
          addFactOp="append"
          setAddFactOp={vi.fn()}
          addFactSplit={2}
          setAddFactSplit={vi.fn()}
          sibling={false}
          setSibling={vi.fn()}
          addingFacts={false}
          addFactsError=""
          onSubmit={vi.fn((e: React.FormEvent) => e.preventDefault())}
        />
      );
      expect(screen.getByTestId("add-facts-template")).toHaveTextContent(
        "[[[0,1],[2]]]"
      );
    });
  });
});
