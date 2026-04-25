import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { DeckCardSidesTypography, DeckCardTypographySide } from "@/lib/deckCardTypography";
import { clampDeckCardSidesTypography } from "@/lib/deckCardTypography";

interface DeckCardFontDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: DeckCardSidesTypography;
  onChange: (next: DeckCardSidesTypography) => void;
}

function SideSliders({
  title,
  sideId,
  side,
  onSideChange,
}: {
  title: string;
  sideId: "front" | "back";
  side: DeckCardTypographySide;
  onSideChange: (next: DeckCardTypographySide) => void;
}) {
  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <legend className="text-sm font-medium px-1">{title}</legend>
      <div className="space-y-1">
        <div className="flex justify-between gap-2 text-xs text-muted-foreground">
          <Label htmlFor={`card-font-main-${sideId}`}>Main text</Label>
          <span>{side.baseFontSize.toFixed(1)}px</span>
        </div>
        <input
          id={`card-font-main-${sideId}`}
          type="range"
          min={12}
          max={32}
          step={0.5}
          value={side.baseFontSize}
          onChange={(e) =>
            onSideChange({ ...side, baseFontSize: parseFloat(e.target.value) })
          }
          className="w-full h-2 rounded-full bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
        />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-2 text-xs text-muted-foreground">
          <Label htmlFor={`card-font-ruby-${sideId}`}>Ruby readings</Label>
          <span>{side.rubyFontSize.toFixed(1)}px</span>
        </div>
        <input
          id={`card-font-ruby-${sideId}`}
          type="range"
          min={6}
          max={28}
          step={0.5}
          value={side.rubyFontSize}
          onChange={(e) =>
            onSideChange({ ...side, rubyFontSize: parseFloat(e.target.value) })
          }
          className="w-full h-2 rounded-full bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
        />
      </div>
    </fieldset>
  );
}

export function DeckCardFontDialog({ open, onOpenChange, value, onChange }: DeckCardFontDialogProps) {
  if (!open) return null;

  const setFront = (front: DeckCardTypographySide) => {
    onChange(clampDeckCardSidesTypography({ ...value, front }));
  };
  const setBack = (back: DeckCardTypographySide) => {
    onChange(clampDeckCardSidesTypography({ ...value, back }));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="deck-card-font-title">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        className="relative z-[61] w-full max-w-md rounded-lg border bg-card p-6 shadow-lg space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="deck-card-font-title" className="text-lg font-semibold">
          Change Font
        </h2>
        <p className="text-sm text-muted-foreground">
          Main text and ruby reading sizes for the front and back of study cards. Saved in this browser only.
        </p>
        <div className="space-y-4 max-h-[min(70vh,32rem)] overflow-y-auto pr-1">
          <SideSliders title="Front" sideId="front" side={value.front} onSideChange={setFront} />
          <SideSliders title="Back" sideId="back" side={value.back} onSideChange={setBack} />
        </div>
        <div className="flex justify-end pt-2">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
