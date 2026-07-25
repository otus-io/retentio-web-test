import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "@/components/ui/dialog";

describe("Dialog", () => {
  it("renders nothing when open is false", () => {
    render(<Dialog open={false} onOpenChange={vi.fn()} title="Test" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title and children when open", () => {
    render(
      <Dialog open onOpenChange={vi.fn()} title="Delete deck?">
        Are you sure?
      </Dialog>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete deck?")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("uses custom confirmLabel and cancelLabel", () => {
    render(
      <Dialog open onOpenChange={vi.fn()} title="Confirm" confirmLabel="Yes, delete" cancelLabel="No thanks" />
    );
    expect(screen.getByRole("button", { name: /yes, delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /no thanks/i })).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Dialog open onOpenChange={onOpenChange} title="Confirm?" />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onConfirm and onOpenChange(false) when Confirm is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Confirm?" onConfirm={onConfirm} confirmLabel="OK" />
    );
    await user.click(screen.getByRole("button", { name: /ok/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange(false) when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { container } = render(<Dialog open onOpenChange={onOpenChange} title="Test" />);
    const backdrop = container.querySelector("[aria-hidden='true']") as Element;
    await user.click(backdrop);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange(false) on Escape key", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Dialog open onOpenChange={onOpenChange} title="Esc test" />);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders destructive confirm button with bg-destructive class", () => {
    render(
      <Dialog open onOpenChange={vi.fn()} title="Delete" confirmLabel="Delete" variant="destructive" />
    );
    expect(screen.getByRole("button", { name: /delete/i })).toHaveClass("bg-destructive");
  });

  it("renders default confirm button without bg-destructive class", () => {
    render(
      <Dialog open onOpenChange={vi.fn()} title="Confirm" confirmLabel="Confirm" variant="default" />
    );
    expect(screen.getByRole("button", { name: /confirm/i })).not.toHaveClass("bg-destructive");
  });
});
