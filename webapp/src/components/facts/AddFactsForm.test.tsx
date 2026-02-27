import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddFactsForm } from "./AddFactsForm";
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

function renderForm(overrides: Partial<Parameters<typeof AddFactsForm>[0]> = {}) {
  const props = {
    deck: mockDeck,
    factsRows: [["", ""]],
    setFactsRows: vi.fn(),
    addFactOp: "append" as const,
    setAddFactOp: vi.fn(),
    addFactSplit: 1,
    setAddFactSplit: vi.fn(),
    sibling: false,
    setSibling: vi.fn(),
    addingFacts: false,
    addFactsError: "",
    onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    mediaFiles: [],
    setMediaFiles: vi.fn(),
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

  it("renders one Value input per factsRow entry", () => {
    renderForm({ factsRows: [["Hello", "你好"]] });
    const inputs = screen.getAllByPlaceholderText("Value");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue("Hello");
    expect(inputs[1]).toHaveValue("你好");
  });

  it("renders deck field names as labels", () => {
    renderForm({ factsRows: [["", ""]] });
    // each field name appears in both a sr-only <label> and a visible <span>
    expect(screen.getAllByText("English").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Chinese").length).toBeGreaterThanOrEqual(1);
  });

  it("calls setFactsRows when a field value is typed", async () => {
    const user = userEvent.setup();
    const { setFactsRows } = renderForm({ factsRows: [["", ""]] });
    const [first] = screen.getAllByPlaceholderText("Value");
    await user.type(first, "A");
    expect(setFactsRows).toHaveBeenCalled();
    const calls = (setFactsRows as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1]?.[0] as string[][] | undefined;
    expect(lastCall).toBeDefined();
    expect(lastCall![0][0]).toBe("A");
  });

  it("Add field button calls setFactsRows with one more empty column", async () => {
    const user = userEvent.setup();
    const { setFactsRows } = renderForm({ factsRows: [["", ""]] });
    await user.click(screen.getByRole("button", { name: /add field/i }));
    expect(setFactsRows).toHaveBeenCalledWith([["", "", ""]]);
  });

  it("Remove field button calls setFactsRows with that column removed", async () => {
    const user = userEvent.setup();
    const { setFactsRows } = renderForm({ factsRows: [["Hello", "你好"]] });
    const removeButtons = screen.getAllByRole("button", { name: /remove field/i });
    await user.click(removeButtons[0]);
    expect(setFactsRows).toHaveBeenCalledWith([["你好"]]);
  });

  it("disables the Add facts submit button when all fields are empty", () => {
    renderForm({ factsRows: [["", ""]] });
    expect(screen.getByRole("button", { name: /add facts/i })).toBeDisabled();
  });

  it("enables the Add facts submit button when at least one field has a value", () => {
    renderForm({ factsRows: [["Hello", ""]] });
    expect(screen.getByRole("button", { name: /add facts/i })).not.toBeDisabled();
  });

  it("calls onSubmit when Add facts is clicked with a non-empty value", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ factsRows: [["Hello", "你好"]] });
    await user.click(screen.getByRole("button", { name: /add facts/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows addFactsError when provided", () => {
    renderForm({ addFactsError: "At least one fact is required." });
    expect(screen.getByText("At least one fact is required.")).toBeInTheDocument();
  });

  it("disables all inputs and buttons while addingFacts is true", () => {
    renderForm({ factsRows: [["Hello", "你好"]], addingFacts: true });
    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
    for (const input of screen.getAllByPlaceholderText("Value")) {
      expect(input).toBeDisabled();
    }
  });

  it("shows Adding… text on submit button when addingFacts is true", () => {
    renderForm({ factsRows: [["Hello", "你好"]], addingFacts: true });
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

  it("Add media button is disabled once 2 media files are attached", () => {
    const file1 = new File(["a"], "a.mp3", { type: "audio/mpeg" });
    const file2 = new File(["b"], "b.png", { type: "image/png" });
    renderForm({
      mediaFiles: [
        { file: file1, type: "audio" },
        { file: file2, type: "image" },
      ],
    });
    expect(screen.getByRole("button", { name: /add media/i })).toBeDisabled();
  });

  it("renders attached media files with their type label and name", () => {
    const file = new File(["data"], "sound.mp3", { type: "audio/mpeg" });
    renderForm({ mediaFiles: [{ file, type: "audio" }] });
    expect(screen.getByText("Audio")).toBeInTheDocument();
    expect(screen.getByText("sound.mp3")).toBeInTheDocument();
  });

  it("calls setMediaFiles with the file removed when Remove is clicked on a media entry", async () => {
    const user = userEvent.setup();
    const file = new File(["data"], "sound.mp3", { type: "audio/mpeg" });
    const { setMediaFiles } = renderForm({ mediaFiles: [{ file, type: "audio" }] });
    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(setMediaFiles).toHaveBeenCalledWith([]);
  });

  it("renders Front and Back section labels when there are 2+ fields", () => {
    renderForm({ factsRows: [["", ""]], addFactSplit: 1 });
    expect(screen.getByRole("button", { name: /collapse front/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse back/i })).toBeInTheDocument();
  });
});
