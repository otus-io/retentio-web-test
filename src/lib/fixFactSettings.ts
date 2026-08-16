import { getDefaultTextTranslationModel } from "./fixFactLlm";
import { getDefaultTtsModel } from "./fixFactTts";

export type FixFactSettings = {
  sourceCol: number;
  translationCol: number;
  translationLang: string;
  textModel: string;
  ttsModel: string;
};

function storageKey(deckId: string): string {
  return `retentio_fix_fact_v1:${deckId}`;
}

export function defaultFixFactSettings(fields: string[]): FixFactSettings {
  const srcIdx = fields.findIndex((f) => f === "日文" || f.toLowerCase() === "japanese");
  const trIdx = fields.findIndex(
    (f) => f === "中文" || f === "例句中文" || f.toLowerCase() === "chinese"
  );
  return {
    sourceCol: srcIdx >= 0 ? srcIdx : 0,
    translationCol: trIdx >= 0 ? trIdx : Math.min(1, Math.max(0, fields.length - 1)),
    translationLang: "Chinese",
    textModel: getDefaultTextTranslationModel(),
    ttsModel: getDefaultTtsModel(),
  };
}

export function loadFixFactSettings(deckId: string, fields: string[]): FixFactSettings {
  const defaults = defaultFixFactSettings(fields);
  try {
    const raw = localStorage.getItem(storageKey(deckId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<FixFactSettings>;
    const n = fields.length;
    const clamp = (v: unknown, fallback: number) => {
      const i = typeof v === "number" ? v : fallback;
      if (!Number.isInteger(i) || i < 0 || i >= n) return fallback;
      return i;
    };
    return {
      sourceCol: clamp(parsed.sourceCol, defaults.sourceCol),
      translationCol: clamp(parsed.translationCol, defaults.translationCol),
      translationLang:
        typeof parsed.translationLang === "string" && parsed.translationLang.trim()
          ? parsed.translationLang.trim()
          : defaults.translationLang,
      textModel:
        typeof parsed.textModel === "string" && parsed.textModel.trim()
          ? parsed.textModel.trim()
          : defaults.textModel,
      ttsModel:
        typeof parsed.ttsModel === "string" && parsed.ttsModel.trim()
          ? parsed.ttsModel.trim()
          : defaults.ttsModel,
    };
  } catch {
    return defaults;
  }
}

export function saveFixFactSettings(deckId: string, settings: FixFactSettings): void {
  try {
    localStorage.setItem(storageKey(deckId), JSON.stringify(settings));
  } catch {
    /* ignore quota */
  }
}

export function canFixContribution(item: {
  status: string;
  type: string;
  fact_id?: string;
}): boolean {
  if (item.status !== "open") return false;
  if (!item.fact_id?.trim()) return false;
  return item.type === "report" || item.type === "fact_edit";
}
