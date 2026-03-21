import { describe, expect, it } from "vitest";
import {
  bulkImportMediaExtOk,
  bulkImportZipEntryIsMedia,
  bulkImportZipPathSkippable,
  listBulkImportMediaPaths,
  normalizeZipPath,
} from "./bulkImportNormalize";

describe("normalizeZipPath", () => {
  it("normalizes backslashes", () => {
    expect(normalizeZipPath("audio\\foo.jpg")).toBe("audio/foo.jpg");
  });
});

describe("bulkImportZipPathSkippable", () => {
  it("skips __MACOSX and AppleDouble", () => {
    expect(bulkImportZipPathSkippable("__MACOSX/foo.jpg")).toBe(true);
    expect(bulkImportZipPathSkippable("folder/._hidden")).toBe(true);
    expect(bulkImportZipPathSkippable("image/苹果.jpg")).toBe(false);
  });
});

describe("bulkImportMediaExtOk / bulkImportZipEntryIsMedia", () => {
  it("allows common media extensions", () => {
    expect(bulkImportMediaExtOk(".jpg")).toBe(true);
    expect(bulkImportMediaExtOk(".WEBP")).toBe(true);
    expect(bulkImportMediaExtOk(".m4a")).toBe(true);
    expect(bulkImportMediaExtOk(".webm")).toBe(true);
    expect(bulkImportMediaExtOk(".doc")).toBe(false);
  });

  it("detects media paths only under audio/image/video (flat)", () => {
    expect(bulkImportZipEntryIsMedia("image/苹果.jpg")).toBe(true);
    expect(bulkImportZipEntryIsMedia("audio/зал.mp3")).toBe(true);
    expect(bulkImportZipEntryIsMedia("video/clip.mp4")).toBe(true);
    expect(bulkImportZipEntryIsMedia("media/苹果.jpg")).toBe(false);
    expect(bulkImportZipEntryIsMedia("image/sub/x.jpg")).toBe(false);
    expect(bulkImportZipEntryIsMedia("readme.txt")).toBe(false);
  });
});

describe("listBulkImportMediaPaths", () => {
  it("returns normalized paths for supported media only", () => {
    expect(
      listBulkImportMediaPaths([
        "ignored/__MACOSX/x",
        "audio/a.mp3",
        "image/b.jpg",
        "facts.csv",
      ])
    ).toEqual(["audio/a.mp3", "image/b.jpg"]);
  });
});
