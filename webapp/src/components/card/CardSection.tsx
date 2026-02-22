import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { DeckItem, FactItem } from "@/lib/api";
import type { GetCardsRes, GetNextCardRes } from "@/lib/api";

function getMinMaxIntervalSeconds(card: GetNextCardRes["data"]["card"]): {
  minIntervalSec: number;
  maxIntervalSec: number;
} {
  const lastReview = card.last_review;
  const dueDate = card.due_date;
  const currentIntervalSec = Math.max(
    60,
    lastReview === 0 ? 60 : Math.max(60, dueDate - lastReview)
  );
  const nowSec = Math.floor(Date.now() / 1000);
  const denom = Math.max(60, dueDate - lastReview);
  const urgency = (nowSec - lastReview) / denom;

  let minIntervalSec: number;
  let maxIntervalSec: number;
  if (urgency >= 1) {
    minIntervalSec = currentIntervalSec * 0.5;
    maxIntervalSec = currentIntervalSec * 4.0;
  } else {
    minIntervalSec = currentIntervalSec * ((0.5 - 1) * urgency + 1);
    maxIntervalSec = currentIntervalSec * ((4.0 - 1) * urgency + 1);
  }
  minIntervalSec = Math.max(60, minIntervalSec);
  maxIntervalSec = Math.max(minIntervalSec, maxIntervalSec);
  return { minIntervalSec, maxIntervalSec };
}

function formatInterval(seconds: number): string {
  const sec = Math.round(seconds);
  if (sec >= 86400) return `${(sec / 86400).toFixed(1)}d`;
  if (sec >= 3600) return `${(sec / 3600).toFixed(1)}h`;
  if (sec >= 60) return `${Math.round(sec / 60)}m`;
  return `${sec}s`;
}

interface CardSectionProps {
  deck: DeckItem | null;
  cardStats: GetCardsRes["data"] | null;
  loadingCards: boolean;
  nextCard: GetNextCardRes["data"] | null;
  nextCardFact: FactItem | null;
  loadingNextCard: boolean;
  cardError: string;
  cardSuccess: string;
  onUpdateCard: (intervalSeconds: number) => void;
  onHideCard: (cardId: string) => void;
}

const SLIDER_DEFAULT = 0.5;

export function CardSection({
  deck,
  cardStats,
  loadingCards,
  nextCard,
  nextCardFact,
  loadingNextCard,
  cardError,
  cardSuccess,
  onUpdateCard,
  onHideCard,
}: CardSectionProps) {
  const [sliderValue, setSliderValue] = useState(SLIDER_DEFAULT);
  const [flipped, setFlipped] = useState(false);
  const [hasFlippedOnce, setHasFlippedOnce] = useState(false);

  useEffect(() => {
    if (nextCard) setSliderValue(SLIDER_DEFAULT);
  }, [nextCard?.card.id]);

  useEffect(() => {
    if (nextCard) {
      setFlipped(false);
      setHasFlippedOnce(false);
    }
  }, [nextCard?.card.id]);

  const handleFlip = () => {
    setFlipped((f) => !f);
    setHasFlippedOnce(true);
  };

  const { minIntervalSec, maxIntervalSec, intervalSec } = useMemo(() => {
    if (!nextCard) return { minIntervalSec: 60, maxIntervalSec: 86400, intervalSec: 43200 };
    const { minIntervalSec: min, maxIntervalSec: max } = getMinMaxIntervalSeconds(nextCard.card);
    const interval = min + (max - min) * sliderValue;
    return { minIntervalSec: min, maxIntervalSec: max, intervalSec: interval };
  }, [nextCard, sliderValue]);

  const handleSubmit = () => {
    onUpdateCard(Math.round(intervalSec));
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Cards</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {cardError && <p className="text-sm text-destructive">{cardError}</p>}
        {cardSuccess && <p className="text-sm text-green-600">{cardSuccess}</p>}
        {!nextCard && loadingNextCard ? (
          <p className="text-muted-foreground">Loading next card…</p>
        ) : cardStats !== null ? (
          <p className="text-sm text-muted-foreground">
            Total: {cardStats.total_cards} · Hidden: {cardStats.hidden_count}
            {cardStats.orphaned_hidden_cards != null &&
              cardStats.orphaned_hidden_cards > 0 &&
              ` · Orphaned: ${cardStats.orphaned_hidden_cards}`}
          </p>
        ) : null}
        {nextCard && nextCardFact && deck && (
          <div className="relative rounded-lg border p-4 space-y-3">
            <div className="absolute top-2 right-2">
              <DropdownMenu align="end">
                <DropdownMenuItem onClick={() => onHideCard(nextCard.card.id)} disabled={loadingNextCard}>
                  Hide
                </DropdownMenuItem>
              </DropdownMenu>
            </div>
            <p className="text-xs text-muted-foreground">
              Due: {new Date(nextCard.card.due_date * 1000).toLocaleString()}
            </p>
            {(() => {
              const frontText = nextCardFact.fields[0] ?? "";
              const backFields = nextCardFact.fields.slice(1);
              return (
                <div
                  className="perspective-[1000px] cursor-pointer select-none min-h-[10rem]"
                  onClick={handleFlip}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleFlip();
                    }
                  }}
                  aria-label={flipped ? "Flip to front" : "Flip to back"}
                >
                  <div
                    className="relative min-h-[10rem] w-full transition-transform duration-300 [transform-style:preserve-3d]"
                    style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                  >
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border bg-card p-4 text-center [backface-visibility:hidden]"
                      style={{ transform: "rotateY(0deg)" }}
                    >
                      <p className="text-lg">{frontText || " "}</p>
                    </div>
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-lg border bg-muted/50 p-4 text-center [backface-visibility:hidden]"
                      style={{ transform: "rotateY(180deg)" }}
                    >
                      {backFields.length > 0 ? (
                        backFields.map((text, i) => (
                          <p key={i} className="text-lg">
                            {text}
                          </p>
                        ))
                      ) : (
                        <p className="text-lg text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Click to flip</p>
                </div>
              );
            })()}
            {hasFlippedOnce && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Hard</span>
                  <span>{formatInterval(intervalSec)}</span>
                  <span>Easy</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={sliderValue}
                  onChange={(e) => setSliderValue(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                />
                <div className="flex justify-center">
                  <Button type="button" className="h-8 px-3 text-xs" onClick={handleSubmit} disabled={loadingNextCard}>
                    {loadingNextCard ? "Loading…" : "Review"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
