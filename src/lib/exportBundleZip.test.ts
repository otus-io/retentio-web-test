import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { bundlePathPrefixFromZip, mediaJobsFromBundle, parseExportBundleFromZip } from "./exportBundleZip";

async function minimalBundleZip(opts: { prefix?: string } = {}) {
  const { prefix = "" } = opts;
  const p = (name: string) => (prefix ? `${prefix}/${name}` : name);
  const z = new JSZip();
  z.file(p("export_meta.json"), JSON.stringify({ model: "Test", facts_written: 1, media_files: 1 }));
  z.file(p("media_manifest.json"), JSON.stringify({ x1: { path: "media/x1.mp3", kind: "audio" } }));
  z.file(
    p("facts.jsonl"),
    `${JSON.stringify({
      entries: [{ text: "hello", audio: "x1" }],
      fields: ["Front", "Back"],
    })}\n`
  );
  z.file(p("media/x1.mp3"), new Uint8Array([0x49, 0x44, 0x33]));
  return z;
}

describe("parseExportBundleFromZip", () => {
  it("accepts flat layout at ZIP root", async () => {
    const z = await minimalBundleZip();
    const parsed = await parseExportBundleFromZip(z);
    expect(parsed.pathPrefix).toBe("");
    expect(parsed.facts).toHaveLength(1);
    expect(parsed.facts[0]?.entries[0]?.text).toBe("hello");
    expect(parsed.facts[0]?.entries[0]?.audio).toBe("x1");
    expect(bundlePathPrefixFromZip(z)).toBe("");
  });

  it("preserves fact tags from facts.jsonl", async () => {
    const z = new JSZip();
    z.file("export_meta.json", JSON.stringify({ model: "Test", facts_written: 1, media_files: 0 }));
    z.file("media_manifest.json", JSON.stringify({}));
    z.file(
      "facts.jsonl",
      `${JSON.stringify({
        entries: [{ text: "hello" }],
        fields: ["Front"],
        tags: ["lesson 1", "noun"],
      })}\n`
    );
    const parsed = await parseExportBundleFromZip(z);
    expect(parsed.facts[0]?.tags).toEqual(["lesson 1", "noun"]);
  });

  it("accepts a single top-level folder", async () => {
    const z = await minimalBundleZip({ prefix: "export" });
    const parsed = await parseExportBundleFromZip(z);
    expect(parsed.pathPrefix).toBe("export");
    const jobs = mediaJobsFromBundle(parsed.manifest, parsed.pathPrefix);
    expect(jobs[0]?.zipPath).toBe("export/media/x1.mp3");
  });

  it("rejects missing media file", async () => {
    const z = new JSZip();
    z.file("export_meta.json", "{}");
    z.file("media_manifest.json", JSON.stringify({ a: { path: "media/missing.mp3", kind: "audio" } }));
    z.file("facts.jsonl", `${JSON.stringify({ entries: [{ text: "x" }], fields: ["A", "B"] })}\n`);
    await expect(parseExportBundleFromZip(z)).rejects.toThrow(/missing media file/);
  });

  it("rejects both facts.json and facts.jsonl", async () => {
    const z = await minimalBundleZip();
    z.file("facts.json", "[]");
    await expect(parseExportBundleFromZip(z)).rejects.toThrow(/not both/);
  });
});
