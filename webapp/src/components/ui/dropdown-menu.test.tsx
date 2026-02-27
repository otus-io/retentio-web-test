import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropdownMenu, DropdownMenuItem } from "./dropdown-menu";

function renderMenu(items = ["Edit", "Delete"], onClicks: (() => void)[] = []) {
  return render(
    <DropdownMenu>
      {items.map((label, i) => (
        <DropdownMenuItem key={label} onClick={onClicks[i]}>
          {label}
        </DropdownMenuItem>
      ))}
    </DropdownMenu>
  );
}

describe("DropdownMenu", () => {
  it("does not show menu items by default", () => {
    renderMenu();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows menu items when trigger is clicked", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("closes menu on Escape key", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes menu after an item is clicked", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("calls onClick of the clicked item", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderMenu(["Edit", "Delete"], [onEdit, onDelete]);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("renders custom trigger content", () => {
    render(
      <DropdownMenu trigger={<span>Actions</span>}>
        <DropdownMenuItem>Item</DropdownMenuItem>
      </DropdownMenu>
    );
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("disables a menu item and prevents onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuItem disabled onClick={onClick}>
          Disabled
        </DropdownMenuItem>
      </DropdownMenu>
    );
    await user.click(screen.getByRole("button"));
    const item = screen.getByRole("menuitem", { name: "Disabled" });
    expect(item).toBeDisabled();
    await user.click(item);
    expect(onClick).not.toHaveBeenCalled();
  });
});
