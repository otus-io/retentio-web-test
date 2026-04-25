import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DECK_CARD_TYPOGRAPHY_DEFAULTS,
  loadDeckCardSidesTypography,
  saveDeckCardSidesTypography,
} from "./deckCardTypography";

describe("deckCardTypography", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal("localStorage", {
      get length() {
        return Object.keys(store).length;
      },
      key(i: number) {
        return Object.keys(store)[i] ?? null;
      },
      getItem(k: string) {
        return store[k] ?? null;
      },
      setItem(k: string, v: string) {
        store[k] = String(v);
      },
      removeItem(k: string) {
        delete store[k];
      },
      clear() {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips defaults", () => {
    saveDeckCardSidesTypography("d1", DECK_CARD_TYPOGRAPHY_DEFAULTS);
    const loaded = loadDeckCardSidesTypography("d1");
    expect(loaded.front.baseFontSize).toBe(18);
    expect(loaded.front.rubyFontSize).toBeCloseTo(9.9, 5);
    expect(loaded.back.baseFontSize).toBe(18);
  });

  it("clamps on load after save", () => {
    saveDeckCardSidesTypography("d2", {
      front: { baseFontSize: 5, rubyFontSize: 4 },
      back: { baseFontSize: 50, rubyFontSize: 40 },
    });
    const loaded = loadDeckCardSidesTypography("d2");
    expect(loaded.front.baseFontSize).toBe(12);
    expect(loaded.front.rubyFontSize).toBe(6);
    expect(loaded.back.baseFontSize).toBe(32);
    expect(loaded.back.rubyFontSize).toBe(28);
  });

  it("migrates legacy single-side keys to front/back and writes new keys", () => {
    localStorage.setItem("deck_typography_base_v1_legacydeck", "20");
    localStorage.setItem("deck_typography_ruby_v1_legacydeck", "11");
    const loaded = loadDeckCardSidesTypography("legacydeck");
    expect(loaded.front.baseFontSize).toBe(20);
    expect(loaded.front.rubyFontSize).toBe(11);
    expect(loaded.back.baseFontSize).toBe(20);
    expect(loaded.back.rubyFontSize).toBe(11);
    expect(localStorage.getItem("deck_typography_base_front_v1_legacydeck")).toBe("20");
    expect(localStorage.getItem("deck_typography_base_back_v1_legacydeck")).toBe("20");
  });
});
