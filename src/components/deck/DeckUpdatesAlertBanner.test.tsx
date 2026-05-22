import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DeckUpdatesAlertBanner } from "./DeckUpdatesAlertBanner";

describe("DeckUpdatesAlertBanner", () => {
  it("renders nothing when count is 0", () => {
    const { container } = render(
      <MemoryRouter>
        <DeckUpdatesAlertBanner updateCount={0} />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows update available message and review link", () => {
    render(
      <MemoryRouter>
        <DeckUpdatesAlertBanner updateCount={2} firstDeckId="deck99" />
      </MemoryRouter>
    );
    expect(screen.getByText(/update available/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review/i })).toHaveAttribute("href", "/decks/deck99");
  });
});
