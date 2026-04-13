import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddFactsForm, makeInitialFactRow, type AddFactEntry } from "./AddFactsForm";
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

function factRowFromValues(values: string[]): AddFactEntry[] {
  const fields = mockDeck.field ?? [];
  return values.map((text, i) => ({
    label: fields[i] ?? `Field ${i + 1}`,
    text,
    media: [],
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
  it("renders the add facts heading", () => {
    renderForm();
    expect(screen.getByText("Add facts", { selector: "p" })).toBeInTheDocument();
  });

  it("renders one value input per factRow text cell", () => {
    renderForm({ factRow: factRowFromValues(["Hello", "你好"]) });
    const inputs = screen.getAllByPlaceholderText("value");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue("Hello");
    expect(inputs[1]).toHaveValue("你好");
  });

  it("renders deck field names as labels", () => {
    renderForm();
    const labelInputs = screen.getAllByLabelText("Field name");
    const values = labelInputs.map((input) => (input as HTMLInputElement).value);
    expect(values).toContain("English");
    expect(values).toContain("Chinese");
  });

  it("calls setFactRow when a field value is typed", async () => {
    const user = userEvent.setup();
    const { setFactRow } = renderForm();
    const [first] = screen.getAllByPlaceholderText("value");
    await user.type(first, "A");
    expect(setFactRow).toHaveBeenCalled();
    const calls = (setFactRow as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1]?.[0] as AddFactEntry[] | undefined;
    expect(lastCall).toBeDefined();
    expect(lastCall!.length).toBe(2);
    expect(lastCall![0].text).toBe("A");
  });

  it("calls setFactRow when a field name is edited", () => {
    const { setFactRow } = renderForm();
    const [firstLabelInput] = screen.getAllByLabelText("Field name");
    // Controlled inputs: mock setFactRow does not update `factRow` props, so multi-key
    // user.type() would fight stale state. One change event matches real onChange behavior.
    fireEvent.change(firstLabelInput, { target: { value: "English Updated" } });
    expect(setFactRow).toHaveBeenCalled();
    const calls = (setFactRow as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1]?.[0] as AddFactEntry[] | undefined;
    expect(lastCall).toBeDefined();
    expect(lastCall![0].label).toContain("Updated");
  });

  it("Add field button calls setFactRow with one more text cell", async () => {
    const user = userEvent.setup();
    const { setFactRow } = renderForm();
    await user.click(screen.getByRole("button", { name: /add field/i }));
    expect(setFactRow).toHaveBeenCalled();
    const calls = (setFactRow as ReturnType<typeof vi.fn>).mock.calls;
    const lastRow = calls[calls.length - 1]?.[0] as AddFactEntry[];
    expect(lastRow).toHaveLength(3);
    expect(lastRow.every((e) => e.media.length === 0)).toBe(true);
  });

  it("Remove field button calls setFactRow with that cell removed", async () => {
    const user = userEvent.setup();
    const { setFactRow } = renderForm({ factRow: factRowFromValues(["Hello", "你好"]) });
    const removeButtons = screen.getAllByRole("button", { name: /remove field/i });
    await user.click(removeButtons[0]);
    expect(setFactRow).toHaveBeenCalled();
    const calls = (setFactRow as ReturnType<typeof vi.fn>).mock.calls;
    const lastRow = calls[calls.length - 1]?.[0] as AddFactEntry[];
    expect(lastRow).toHaveLength(1);
    expect(lastRow[0].text).toBe("你好");
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
    for (const input of screen.getAllByPlaceholderText("value")) {
      expect(input).toBeDisabled();
    }
  });

  it("shows Adding… text on submit button when addingFacts is true", () => {
    renderForm({ factRow: factRowFromValues(["Hello", "你好"]), addingFacts: true });
    expect(screen.getByRole("button", { name: /adding…/i })).toBeInTheDocument();
  });

  it("renders the operation select with append selected by default", () => {
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

  it("each row has an options menu with Add media", async () => {
    const user = userEvent.setup();
    renderForm();
    const triggers = screen.getAllByRole("button", { name: "…" });
    expect(triggers.length).toBeGreaterThanOrEqual(2);
    await user.click(triggers[0]);
    expect(screen.getByRole("menuitem", { name: /add media/i })).toBeInTheDocument();
  });

  it("renders attached media file name in the entry row", () => {
    const file = new File(["data"], "sound.mp3", { type: "audio/mpeg" });
    const row: AddFactEntry[] = [
      { label: "English", text: "", media: [{ file }] },
      { label: "Chinese", text: "", media: [] },
    ];
    renderForm({ factRow: row });
    expect(screen.getByText("sound.mp3")).toBeInTheDocument();
  });

  it("renders attached image file name in the entry row", () => {
    const file = new File(["data"], "photo.png", { type: "image/png" });
    const row: AddFactEntry[] = [
      { label: "English", text: "", media: [{ file }] },
      { label: "Chinese", text: "", media: [] },
    ];
    renderForm({ factRow: row });
    expect(screen.getByText("photo.png")).toBeInTheDocument();
  });

  it("renders attached video file name in the entry row", () => {
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });
    const row: AddFactEntry[] = [
      { label: "English", text: "", media: [{ file }] },
      { label: "Chinese", text: "", media: [] },
    ];
    renderForm({ factRow: row });
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
  });

  it("calls setFactRow with media removed when Remove media is clicked", async () => {
    const user = userEvent.setup();
    const file = new File(["data"], "sound.mp3", { type: "audio/mpeg" });
    const row: AddFactEntry[] = [
      { label: "English", text: "", media: [{ file }] },
      { label: "Chinese", text: "", media: [] },
    ];
    const { setFactRow } = renderForm({ factRow: row });
    const removeMedia = screen.getByRole("button", { name: /remove media/i });
    await user.click(removeMedia);
    expect(setFactRow).toHaveBeenCalled();
    const calls = (setFactRow as ReturnType<typeof vi.fn>).mock.calls;
    const lastRow = calls[calls.length - 1]?.[0] as AddFactEntry[];
    expect(lastRow[0].media).toHaveLength(0);
  });

  it("renders front and back section labels when there are 2+ cells", () => {
    renderForm({ addFactSplit: 1 });
    expect(screen.getByRole("button", { name: /collapse front/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse back/i })).toBeInTheDocument();
  });

  describe("template display (cut line)", () => {
    it("shows default template when split is 1 and sibling unchecked", () => {
      renderForm({ factRow: factRowFromValues(["a", "b"]), addFactSplit: 1, sibling: false });
      expect(screen.getByTestId("add-facts-template")).toHaveTextContent(
        "Default (0 front, rest back)"
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
        "Default (0 front, rest back)"
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
