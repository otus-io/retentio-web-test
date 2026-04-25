/** Per-deck card typography; localStorage keys match Retentio Flutter (`deck_card_typography.dart`). */

export type DeckCardTypographySide = {
  baseFontSize: number;
  rubyFontSize: number;
};

export type DeckCardSidesTypography = {
  front: DeckCardTypographySide;
  back: DeckCardTypographySide;
};

export const DECK_CARD_TYPOGRAPHY_DEFAULTS: DeckCardSidesTypography = {
  front: { baseFontSize: 18, rubyFontSize: 9.9 },
  back: { baseFontSize: 18, rubyFontSize: 9.9 },
};

const MIN_BASE = 12;
const MAX_BASE = 32;
const MIN_RUBY = 6;
const MAX_RUBY = 28;

export function clampDeckCardTypographySide(side: DeckCardTypographySide): DeckCardTypographySide {
  return {
    baseFontSize: Math.min(MAX_BASE, Math.max(MIN_BASE, side.baseFontSize)),
    rubyFontSize: Math.min(MAX_RUBY, Math.max(MIN_RUBY, side.rubyFontSize)),
  };
}

export function clampDeckCardSidesTypography(v: DeckCardSidesTypography): DeckCardSidesTypography {
  return {
    front: clampDeckCardTypographySide(v.front),
    back: clampDeckCardTypographySide(v.back),
  };
}

function prefsBaseFrontKey(deckId: string) {
  return `deck_typography_base_front_v1_${deckId}`;
}
function prefsRubyFrontKey(deckId: string) {
  return `deck_typography_ruby_front_v1_${deckId}`;
}
function prefsBaseBackKey(deckId: string) {
  return `deck_typography_base_back_v1_${deckId}`;
}
function prefsRubyBackKey(deckId: string) {
  return `deck_typography_ruby_back_v1_${deckId}`;
}
function prefsLegacyBaseKey(deckId: string) {
  return `deck_typography_base_v1_${deckId}`;
}
function prefsLegacyRubyKey(deckId: string) {
  return `deck_typography_ruby_v1_${deckId}`;
}

function readStoredNumber(key: string): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function loadDeckCardSidesTypography(deckId: string): DeckCardSidesTypography {
  if (typeof localStorage === "undefined") {
    return { ...DECK_CARD_TYPOGRAPHY_DEFAULTS, front: { ...DECK_CARD_TYPOGRAPHY_DEFAULTS.front }, back: { ...DECK_CARD_TYPOGRAPHY_DEFAULTS.back } };
  }

  const bf = readStoredNumber(prefsBaseFrontKey(deckId));
  const rf = readStoredNumber(prefsRubyFrontKey(deckId));
  const bb = readStoredNumber(prefsBaseBackKey(deckId));
  const rb = readStoredNumber(prefsRubyBackKey(deckId));

  if (bf != null || rf != null || bb != null || rb != null) {
    return clampDeckCardSidesTypography({
      front: {
        baseFontSize: bf ?? DECK_CARD_TYPOGRAPHY_DEFAULTS.front.baseFontSize,
        rubyFontSize: rf ?? DECK_CARD_TYPOGRAPHY_DEFAULTS.front.rubyFontSize,
      },
      back: {
        baseFontSize: bb ?? DECK_CARD_TYPOGRAPHY_DEFAULTS.back.baseFontSize,
        rubyFontSize: rb ?? DECK_CARD_TYPOGRAPHY_DEFAULTS.back.rubyFontSize,
      },
    });
  }

  const legacyB = readStoredNumber(prefsLegacyBaseKey(deckId));
  const legacyR = readStoredNumber(prefsLegacyRubyKey(deckId));
  if (legacyB != null || legacyR != null) {
    const leg = clampDeckCardTypographySide({
      baseFontSize: legacyB ?? DECK_CARD_TYPOGRAPHY_DEFAULTS.front.baseFontSize,
      rubyFontSize: legacyR ?? DECK_CARD_TYPOGRAPHY_DEFAULTS.front.rubyFontSize,
    });
    const migrated: DeckCardSidesTypography = { front: leg, back: { ...leg } };
    saveDeckCardSidesTypography(deckId, migrated);
    return migrated;
  }

  return {
    front: { ...DECK_CARD_TYPOGRAPHY_DEFAULTS.front },
    back: { ...DECK_CARD_TYPOGRAPHY_DEFAULTS.back },
  };
}

export function saveDeckCardSidesTypography(deckId: string, value: DeckCardSidesTypography): void {
  if (typeof localStorage === "undefined") return;
  const v = clampDeckCardSidesTypography(value);
  localStorage.setItem(prefsBaseFrontKey(deckId), String(v.front.baseFontSize));
  localStorage.setItem(prefsRubyFrontKey(deckId), String(v.front.rubyFontSize));
  localStorage.setItem(prefsBaseBackKey(deckId), String(v.back.baseFontSize));
  localStorage.setItem(prefsRubyBackKey(deckId), String(v.back.rubyFontSize));
}
