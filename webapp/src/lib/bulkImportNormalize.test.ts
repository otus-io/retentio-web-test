import { describe, expect, it } from "vitest";
import {
  bulkImportCellMatchesMedia,
  bulkImportMediaExtOk,
  bulkImportZipEntryIsMedia,
  bulkImportZipPathSkippable,
  formatMatchedMediaForRow,
  listBulkImportMediaPaths,
  listMatchedMediaPathsForPreview,
  normalizeZipPath,
} from "./bulkImportNormalize";

describe("listBulkImportMediaPaths + formatMatchedMediaForRow (hybrid match)", () => {
  it("matches basename per cell (same file may appear for multiple columns)", () => {
    const paths = listBulkImportMediaPaths(["ignored/__MACOSX/x", "images/苹果.jpg"]);
    expect(formatMatchedMediaForRow(["苹果", "苹果.jpg", "extra"], paths)).toBe("苹果.jpg; 苹果.jpg");
  });

  it("matches full zip path", () => {
    const paths = listBulkImportMediaPaths(["a/hello world.mp3"]);
    expect(formatMatchedMediaForRow(["front", "a/hello world.mp3"], paths)).toBe("hello world.mp3");
  });

  it("matches path with backslashes in cell", () => {
    const paths = listBulkImportMediaPaths(["media/foo.mp3"]);
    expect(formatMatchedMediaForRow(["media\\foo.mp3"], paths)).toBe("foo.mp3");
  });

  it("no match when cell text differs", () => {
    const paths = listBulkImportMediaPaths(["a/other.jpg"]);
    expect(formatMatchedMediaForRow(["苹果", "otherx"], paths)).toBe("");
  });

  it("matches basename stem without extension", () => {
    const paths = listBulkImportMediaPaths(["m/あおい.mp3"]);
    expect(formatMatchedMediaForRow(["青[あお]い", "あおい"], paths)).toBe("あおい.mp3; あおい.mp3");
  });

  it("matches Anki [sound:...] token", () => {
    const paths = listBulkImportMediaPaths(["m/あおい.mp3"]);
    expect(formatMatchedMediaForRow(["[sound:あおい.mp3]"], paths)).toBe("あおい.mp3");
  });

  it("matches [sound:...] token with zip path", () => {
    const paths = listBulkImportMediaPaths(["medias/あおい.mp3"]);
    expect(formatMatchedMediaForRow(["[sound:medias/あおい.mp3]"], paths)).toBe("あおい.mp3");
  });

  it("matches ruby-derived reading form", () => {
    const paths = listBulkImportMediaPaths(["m/あおい.mp3"]);
    expect(formatMatchedMediaForRow(["青[あお]い"], paths)).toBe("あおい.mp3");
  });

  it("matches ruby-derived reading form with spaces", () => {
    const paths = listBulkImportMediaPaths(["m/あのひと.mp3"]);
    expect(formatMatchedMediaForRow(["あの 人[ひと]"], paths)).toBe("あのひと.mp3");
  });

  it("does not match shorter stem when cell ends with ？ (あれ vs あれ？)", () => {
    const paths = listBulkImportMediaPaths(["m/あれ.mp3", "m/あれ？.mp3"]);
    expect(formatMatchedMediaForRow(["あれ？"], paths)).toBe("あれ？.mp3");
  });

  it("two files when two cells match", () => {
    const paths = listBulkImportMediaPaths(["m/a.mp3", "m/b.jpg"]);
    expect(formatMatchedMediaForRow(["a.mp3", "lesson", "b.jpg"], paths)).toBe("a.mp3; b.jpg");
  });
});

describe("listMatchedMediaPathsForPreview", () => {
  it("returns union of paths matched by any row", () => {
    const paths = listBulkImportMediaPaths(["m/a.mp3", "m/b.jpg", "m/c.png"]);
    const rows = [
      { values: ["a.mp3", "x"] },
      { values: ["front", "b.jpg"] },
    ];
    expect(listMatchedMediaPathsForPreview(rows, paths)).toEqual(["m/a.mp3", "m/b.jpg"]);
  });

  it("omits zip files not referenced by any row", () => {
    const paths = listBulkImportMediaPaths(["m/only.jpg", "m/unused.png"]);
    expect(listMatchedMediaPathsForPreview([{ values: ["only.jpg", "y"] }], paths)).toEqual([
      "m/only.jpg",
    ]);
  });

  it("empty when no row matches any media", () => {
    const paths = listBulkImportMediaPaths(["m/x.mp3"]);
    expect(listMatchedMediaPathsForPreview([{ values: ["text", "no media"] }], paths)).toEqual([]);
  });
});

describe("bulkImportCellMatchesMedia", () => {
  it("respects case (exact)", () => {
    expect(bulkImportCellMatchesMedia("A.mp3", "m/A.mp3", "A.mp3")).toBe(true);
    expect(bulkImportCellMatchesMedia("a.mp3", "m/A.mp3", "A.mp3")).toBe(false);
  });
});

describe("normalizeZipPath", () => {
  it("normalizes backslashes", () => {
    expect(normalizeZipPath("media\\foo.jpg")).toBe("media/foo.jpg");
  });
});

describe("bulkImportZipPathSkippable", () => {
  it("skips __MACOSX and AppleDouble", () => {
    expect(bulkImportZipPathSkippable("__MACOSX/foo.jpg")).toBe(true);
    expect(bulkImportZipPathSkippable("folder/._hidden")).toBe(true);
    expect(bulkImportZipPathSkippable("assets/苹果.jpg")).toBe(false);
  });
});

describe("bulkImportMediaExtOk / bulkImportZipEntryIsMedia", () => {
  it("allows common media extensions", () => {
    expect(bulkImportMediaExtOk(".jpg")).toBe(true);
    expect(bulkImportMediaExtOk(".WEBP")).toBe(true);
    expect(bulkImportMediaExtOk(".m4a")).toBe(true);
    expect(bulkImportMediaExtOk(".doc")).toBe(false);
  });

  it("detects media paths", () => {
    expect(bulkImportZipEntryIsMedia("media/苹果.jpg")).toBe(true);
    expect(bulkImportZipEntryIsMedia("фото/зал.jpg")).toBe(true);
    expect(bulkImportZipEntryIsMedia("readme.txt")).toBe(false);
  });
});
