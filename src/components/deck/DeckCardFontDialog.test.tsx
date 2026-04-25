import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeckCardFontDialog } from "./DeckCardFontDialog";
import { DECK_CARD_TYPOGRAPHY_DEFAULTS } from "@/lib/deckCardTypography";

describe("DeckCardFontDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <DeckCardFontDialog
        open={false}
        onOpenChange={vi.fn()}
        value={DECK_CARD_TYPOGRAPHY_DEFAULTS}
        onChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog title and closes on Done", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <DeckCardFontDialog
        open
        onOpenChange={onOpenChange}
        value={DECK_CARD_TYPOGRAPHY_DEFAULTS}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /change font/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onChange with updated front main size when front slider changes", () => {
    const onChange = vi.fn();
    render(
      <DeckCardFontDialog open onOpenChange={vi.fn()} value={DECK_CARD_TYPOGRAPHY_DEFAULTS} onChange={onChange} />
    );
    const frontMain = document.getElementById("card-font-main-front") as HTMLInputElement;
    expect(frontMain).toBeTruthy();
    fireEvent.change(frontMain, { target: { value: "22" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as typeof DECK_CARD_TYPOGRAPHY_DEFAULTS;
    expect(next.front.baseFontSize).toBe(22);
    expect(next.back).toEqual(DECK_CARD_TYPOGRAPHY_DEFAULTS.back);
  });

  it("clamps front main size below minimum", () => {
    const onChange = vi.fn();
    render(
      <DeckCardFontDialog open onOpenChange={vi.fn()} value={DECK_CARD_TYPOGRAPHY_DEFAULTS} onChange={onChange} />
    );
    const frontMain = document.getElementById("card-font-main-front") as HTMLInputElement;
    fireEvent.change(frontMain, { target: { value: "8" } });
    const next = onChange.mock.calls[0][0] as typeof DECK_CARD_TYPOGRAPHY_DEFAULTS;
    expect(next.front.baseFontSize).toBe(12);
  });
});
