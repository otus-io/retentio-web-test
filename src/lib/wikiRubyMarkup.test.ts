import { describe, it, expect } from "vitest";
import { looksLikeWikiRubyMarkup, parseWikiRubyMarkup } from "./wikiRubyMarkup";

describe("looksLikeWikiRubyMarkup", () => {
  it("is false for plain text", () => {
    expect(looksLikeWikiRubyMarkup("hello")).toBe(false);
  });

  it("is true when a valid pair exists", () => {
    expect(looksLikeWikiRubyMarkup("[[皆|みな]]")).toBe(true);
    expect(looksLikeWikiRubyMarkup("x [[a|b]] y")).toBe(true);
  });
});

describe("parseWikiRubyMarkup", () => {
  it("returns a single plain segment when there are no pairs", () => {
    expect(parseWikiRubyMarkup("no ruby")).toEqual([{ type: "plain", text: "no ruby" }]);
  });

  it("parses Japanese example like the mobile app", () => {
    expect(parseWikiRubyMarkup("[[皆|みな]]さんは[[思|おも]]い")).toEqual([
      { type: "ruby", main: "皆", reading: "みな" },
      { type: "plain", text: "さんは" },
      { type: "ruby", main: "思", reading: "おも" },
      { type: "plain", text: "い" },
    ]);
  });

  it("handles empty input", () => {
    expect(parseWikiRubyMarkup("")).toEqual([{ type: "plain", text: "" }]);
  });
});
