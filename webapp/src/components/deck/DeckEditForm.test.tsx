import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeckEditForm } from "./DeckEditForm";

function renderForm(overrides: Partial<Parameters<typeof DeckEditForm>[0]> = {}) {
  const props = {
    name: "My Deck",
    setName: vi.fn(),
    fieldNames: ["English", "Chinese"],
    setFieldNames: vi.fn(),
    rate: 20,
    setRate: vi.fn(),
    saving: false,
    onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<DeckEditForm {...props} />);
  return props;
}

describe("DeckEditForm", () => {
  it("renders the name input with current value", () => {
    renderForm();
    expect(screen.getByLabelText(/name/i)).toHaveValue("My Deck");
  });

  it("renders all field name inputs", () => {
    renderForm();
    expect(screen.getByDisplayValue("English")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Chinese")).toBeInTheDocument();
  });

  it("renders the rate input with current value", () => {
    renderForm();
    expect(screen.getByLabelText(/rate/i)).toHaveValue(20);
  });

  it("calls setName when name input changes", async () => {
    const user = userEvent.setup();
    const { setName } = renderForm();
    const input = screen.getByLabelText(/name/i);
    await user.clear(input);
    await user.type(input, "Z");
    expect(setName).toHaveBeenCalled();
  });

  it("calls setFieldNames when a field input changes", async () => {
    const user = userEvent.setup();
    const { setFieldNames } = renderForm();
    await user.clear(screen.getByDisplayValue("English"));
    await user.type(screen.getByDisplayValue(""), "E");
    expect(setFieldNames).toHaveBeenCalled();
  });

  it("does not show Remove buttons when there are exactly 2 fields", () => {
    renderForm();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("shows Remove buttons for every field when there are more than 2", () => {
    renderForm({ fieldNames: ["A", "B", "C"] });
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(3);
  });

  it("calls setFieldNames without the removed field when Remove is clicked", async () => {
    const user = userEvent.setup();
    const { setFieldNames } = renderForm({ fieldNames: ["A", "B", "C"] });
    // Remove the first field (index 0 = "A")
    await user.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    expect(setFieldNames).toHaveBeenCalledWith(["B", "C"]);
  });

  it("calls setFieldNames with a new empty field when Add field is clicked", async () => {
    const user = userEvent.setup();
    const { setFieldNames } = renderForm();
    await user.click(screen.getByRole("button", { name: /add field/i }));
    expect(setFieldNames).toHaveBeenCalledWith(["English", "Chinese", ""]);
  });

  it("calls onSubmit when the Save button is clicked", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables Save and shows Saving… when saving is true", () => {
    renderForm({ saving: true });
    const btn = screen.getByRole("button", { name: /saving/i });
    expect(btn).toBeDisabled();
  });

  it("calls onCancel when the Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderForm();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
