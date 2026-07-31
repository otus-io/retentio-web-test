import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DeckHeader } from "@/components/deck/DeckHeader";

function renderHeader(onLogout = vi.fn()) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DeckHeader onLogout={onLogout} />
    </MemoryRouter>
  );
}

describe("DeckHeader", () => {
  it("renders a link to /decks", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: /^deck$/i })).toHaveAttribute("href", "/decks");
  });

  it("renders a link to /tags", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: /^tags$/i })).toHaveAttribute("href", "/tags");
  });

  it("renders a link to /media", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: /^media$/i })).toHaveAttribute("href", "/media");
  });

  it("renders a link to /quality", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: /^quality$/i })).toHaveAttribute("href", "/quality");
  });

  it("renders a link to /profile", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute("href", "/profile");
  });

  it("calls onLogout when the Logout button is clicked", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    renderHeader(onLogout);
    await user.click(screen.getByRole("button", { name: /logout/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
