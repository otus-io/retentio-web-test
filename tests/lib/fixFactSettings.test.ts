import { beforeEach, describe, expect, it } from "vitest";
import {
  canFixContribution,
  defaultFixFactSettings,
  loadFixFactSettings,
  saveFixFactSettings,
} from "@/lib/fixFactSettings";

describe("canFixContribution", () => {
  it("allows open report/fact_edit with fact_id", () => {
    expect(canFixContribution({ status: "open", type: "report", fact_id: "f1" })).toBe(true);
    expect(canFixContribution({ status: "open", type: "fact_edit", fact_id: "f1" })).toBe(true);
  });

  it("rejects missing fact or non-open", () => {
    expect(canFixContribution({ status: "open", type: "report" })).toBe(false);
    expect(canFixContribution({ status: "resolved", type: "report", fact_id: "f1" })).toBe(false);
    expect(canFixContribution({ status: "open", type: "field_rename", fact_id: "f1" })).toBe(
      false
    );
  });
});

describe("fixFactSettings storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults 日文/中文 when present", () => {
    const d = defaultFixFactSettings(["日文", "中文", "例句", "例句中文"]);
    expect(d.sourceCol).toBe(0);
    expect(d.translationCol).toBe(1);
  });

  it("round-trips via localStorage", () => {
    saveFixFactSettings("deck1", {
      sourceCol: 0,
      translationCol: 2,
      translationLang: "English",
      textModel: "gpt-4o",
      ttsModel: "eleven_v3",
    });
    const loaded = loadFixFactSettings("deck1", ["a", "b", "c"]);
    expect(loaded.translationCol).toBe(2);
    expect(loaded.translationLang).toBe("English");
    expect(loaded.ttsModel).toBe("eleven_v3");
  });
});
