import { describe, expect, it } from "vitest";
import { readingForm, surfaceForm } from "@/lib/fixFactRuby";

describe("surfaceForm", () => {
  it("strips [[kanji|reading]] to kanji", () => {
    expect(surfaceForm("[[道|みち]]が出来ます")).toBe("道が出来ます");
  });

  it("strips multiple ruby segments", () => {
    expect(surfaceForm("[[新|あたら]]しい[[道|みち]]")).toBe("新しい道");
  });

  it("trims whitespace", () => {
    expect(surfaceForm("  だれでも  ")).toBe("だれでも");
  });

  it("leaves plain text unchanged", () => {
    expect(surfaceForm("hello")).toBe("hello");
  });
});

describe("readingForm", () => {
  it("strips [[kanji|reading]] to reading", () => {
    expect(readingForm("[[道|みち]]が出来ます")).toBe("みちが出来ます");
  });

  it("strips multiple ruby segments to readings", () => {
    expect(readingForm("[[新|あたら]]しい[[道|みち]]")).toBe("あたらしいみち");
  });

  it("removes spaces between words", () => {
    expect(readingForm("[[道|みち]] が 出来ます")).toBe("みちが出来ます");
  });

  it("leaves plain text without spaces unchanged", () => {
    expect(readingForm("hello")).toBe("hello");
  });
});
