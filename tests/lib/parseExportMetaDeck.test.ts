import { describe, it, expect } from "vitest";
import { parseExportMetaDeck } from "@/lib/parseExportMetaDeck";

describe("parseExportMetaDeck", () => {
  it("parses export_meta shape", () => {
    const out = parseExportMetaDeck({
      model: "x",
      deck: {
        name: "大家的日语",
        description: "Minna no Nihongo vocabulary deck",
        fields: ["日文", "音调核", "词性", "中文"],
        rate: 30,
      },
    });
    expect(out).toEqual({
      name: "大家的日语",
      description: "Minna no Nihongo vocabulary deck",
      fields: ["日文", "音调核", "词性", "中文"],
      rate: 30,
    });
  });

  it("defaults rate to 20 when omitted", () => {
    expect(
      parseExportMetaDeck({
        deck: { name: "A", fields: ["Front", "Back"] },
      }).rate
    ).toBe(20);
  });

  it("trims field strings and drops empties", () => {
    expect(
      parseExportMetaDeck({
        deck: { name: "B", fields: ["  a  ", "", "  b"] },
      }).fields
    ).toEqual(["a", "b"]);
  });

  it("rejects missing deck", () => {
    expect(() => parseExportMetaDeck({})).toThrow(/Missing "deck"/);
  });

  it("rejects empty name", () => {
    expect(() =>
      parseExportMetaDeck({
        deck: { name: "   ", fields: ["A"] },
      })
    ).toThrow(/name is missing/);
  });

  it("rejects invalid rate", () => {
    expect(() =>
      parseExportMetaDeck({
        deck: { name: "A", fields: ["A", "B"], rate: 0 },
      })
    ).toThrow(/rate must be a number/);
  });
});
