import type JSZip from "jszip";
import type { AddFactItemReq } from "@/lib/api";

/** Normalized path inside the bundle ZIP (forward slashes, trimmed). */
export function normalizeBundleZipPath(name: string): string {
  return name.replace(/\\/g, "/").trim().replace(/^\/+/, "");
}

export function bundleZipPathSkippable(norm: string): boolean {
  if (!norm) return true;
  const lower = norm.toLowerCase();
  if (lower.startsWith("__macosx/")) return true;
  const base = norm.split("/").pop() ?? "";
  return base.startsWith("._");
}

export interface MediaManifestEntry {
  path: string;
  kind: string;
}

export type MediaManifest = Record<string, MediaManifestEntry>;

export interface ParsedExportBundle {
  exportMeta: unknown;
  manifest: MediaManifest;
  facts: AddFactItemReq[];
  /** "" when manifests are at ZIP root; otherwise one folder name, e.g. `export`. */
  pathPrefix: string;
}

function safeMediaManifestPath(rel: string): boolean {
  const n = normalizeBundleZipPath(rel);
  if (!n || n.includes("..")) return false;
  const segs = n.split("/").filter(Boolean);
  if (segs.length < 2) return false;
  return segs[0] === "media";
}

function indexZipByPath(zip: JSZip): Map<string, JSZip.JSZipObject> {
  const m = new Map<string, JSZip.JSZipObject>();
  zip.forEach((relPath, file) => {
    if (file.dir) return;
    const n = normalizeBundleZipPath(relPath);
    if (bundleZipPathSkippable(n)) return;
    m.set(n, file);
  });
  return m;
}

/** ZIP root or a single wrapping folder containing the bundle files. */
function detectBundlePathPrefix(byPath: Map<string, JSZip.JSZipObject>): string {
  const markers = ["export_meta.json", "media_manifest.json"] as const;
  const hasAtRoot = markers.every((b) => byPath.has(b));
  if (hasAtRoot) return "";

  const prefixes = new Set<string>();
  for (const key of byPath.keys()) {
    if (bundleZipPathSkippable(key)) continue;
    if (key.endsWith("/export_meta.json")) {
      prefixes.add(key.slice(0, -"/export_meta.json".length));
    }
  }
  if (prefixes.size !== 1) {
    throw new Error(
      "ZIP must contain export_meta.json and media_manifest.json at the archive root, " +
        "or both inside exactly one top-level folder (e.g. export/)."
    );
  }
  const prefix = [...prefixes][0]!;
  for (const b of markers) {
    if (!byPath.has(`${prefix}/${b}`)) {
      throw new Error(`ZIP folder "${prefix}/" is missing ${b}.`);
    }
  }
  return prefix;
}

function entryKey(prefix: string, basename: string): string {
  return prefix ? `${prefix}/${basename}` : basename;
}

function manifestPathToZipKey(manifestRelPath: string, prefix: string): string {
  const rel = normalizeBundleZipPath(manifestRelPath);
  return prefix ? `${prefix}/${rel}` : rel;
}

function parseFactsJsonl(text: string): AddFactItemReq[] {
  const facts: AddFactItemReq[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    try {
      const row = JSON.parse(line) as unknown;
      if (!row || typeof row !== "object" || !("entries" in row)) {
        throw new Error(`Line ${i + 1}: expected object with "entries"`);
      }
      const entries = (row as { entries: unknown }).entries;
      if (!Array.isArray(entries)) throw new Error(`Line ${i + 1}: "entries" must be an array`);
      const out: AddFactItemReq = { entries: entries as AddFactItemReq["entries"] };
      const fields = (row as { fields?: unknown }).fields;
      if (fields !== undefined) {
        if (!Array.isArray(fields) || !fields.every((f) => typeof f === "string")) {
          throw new Error(`Line ${i + 1}: "fields" must be an array of strings when present`);
        }
        out.fields = fields as string[];
      }
      const tags = (row as { tags?: unknown }).tags;
      if (tags !== undefined) {
        if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
          throw new Error(`Line ${i + 1}: "tags" must be an array of strings when present`);
        }
        out.tags = tags as string[];
      }
      facts.push(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`facts.jsonl parse error at line ${i + 1}: ${msg}`);
    }
  }
  return facts;
}

function parseFactsJson(text: string): AddFactItemReq[] {
  const root = JSON.parse(text) as unknown;
  const arr: unknown = Array.isArray(root)
    ? root
    : root && typeof root === "object" && "facts" in root
      ? (root as { facts: unknown }).facts
      : null;
  if (!Array.isArray(arr)) {
    throw new Error('facts.json must be a JSON array or { "facts": [ ... ] }');
  }
  const facts: AddFactItemReq[] = [];
  for (let i = 0; i < arr.length; i++) {
    const row = arr[i];
    if (!row || typeof row !== "object" || !("entries" in row)) {
      throw new Error(`facts[${i}]: expected object with "entries"`);
    }
    const entries = (row as { entries: unknown }).entries;
    if (!Array.isArray(entries)) throw new Error(`facts[${i}]: "entries" must be an array`);
    const out: AddFactItemReq = { entries: entries as AddFactItemReq["entries"] };
    const fields = (row as { fields?: unknown }).fields;
    if (fields !== undefined) {
      if (!Array.isArray(fields) || !fields.every((f) => typeof f === "string")) {
        throw new Error(`facts[${i}]: "fields" must be an array of strings when present`);
      }
      out.fields = fields as string[];
    }
    const tags = (row as { tags?: unknown }).tags;
    if (tags !== undefined) {
      if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
        throw new Error(`facts[${i}]: "tags" must be an array of strings when present`);
      }
      out.tags = tags as string[];
    }
    facts.push(out);
  }
  return facts;
}

/**
 * Validates layout from `anki_export_retentio_facts.py`: `export_meta.json`, `media_manifest.json`,
 * `facts.jsonl` (or `facts.json`), and `media/*` files referenced by the manifest.
 */
export async function parseExportBundleFromZip(zip: JSZip): Promise<ParsedExportBundle> {
  const byPath = indexZipByPath(zip);
  const pathPrefix = detectBundlePathPrefix(byPath);

  const exportMetaFile = byPath.get(entryKey(pathPrefix, "export_meta.json"));
  const manifestFile = byPath.get(entryKey(pathPrefix, "media_manifest.json"));
  if (!exportMetaFile) {
    throw new Error("ZIP must contain export_meta.json.");
  }
  if (!manifestFile) {
    throw new Error("ZIP must contain media_manifest.json.");
  }

  const factsJsonl = byPath.get(entryKey(pathPrefix, "facts.jsonl"));
  const factsJson = byPath.get(entryKey(pathPrefix, "facts.json"));
  if (factsJsonl && factsJson) {
    throw new Error("ZIP must contain either facts.jsonl or facts.json, not both.");
  }
  if (!factsJsonl && !factsJson) {
    throw new Error("ZIP must contain facts.jsonl or facts.json (same shape as exporter output).");
  }

  const exportMetaText = await exportMetaFile.async("string");
  const manifestText = await manifestFile.async("string");
  let exportMeta: unknown;
  try {
    exportMeta = JSON.parse(exportMetaText) as unknown;
  } catch {
    throw new Error("export_meta.json is not valid JSON.");
  }
  let manifest: MediaManifest;
  try {
    manifest = JSON.parse(manifestText) as MediaManifest;
  } catch {
    throw new Error("media_manifest.json is not valid JSON.");
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("media_manifest.json must be a JSON object mapping media id → { path, kind }.");
  }

  const factsText = await (factsJsonl ?? factsJson!).async("string");
  const facts = factsJsonl ? parseFactsJsonl(factsText) : parseFactsJson(factsText);
  if (facts.length === 0) throw new Error("No facts found in facts file.");

  for (const [mid, meta] of Object.entries(manifest)) {
    if (!mid.trim()) throw new Error("media_manifest.json contains an empty media id key.");
    if (!meta || typeof meta !== "object") throw new Error(`Manifest entry for ${JSON.stringify(mid)} must be an object.`);
    const path = typeof meta.path === "string" ? meta.path : "";
    if (!safeMediaManifestPath(path)) {
      throw new Error(
        `Invalid or unsafe media path for id ${JSON.stringify(mid)}: ${JSON.stringify(path)} (expected under media/).`
      );
    }
    const zipKey = manifestPathToZipKey(path, pathPrefix);
    if (!byPath.has(zipKey)) {
      throw new Error(`ZIP missing media file for id ${JSON.stringify(mid)}: ${zipKey} (manifest path: ${path})`);
    }
  }

  return { exportMeta, manifest, facts, pathPrefix };
}

export interface MediaUploadJob {
  clientId: string;
  /** Path inside ZIP (normalized, includes optional folder prefix). */
  zipPath: string;
  filename: string;
}

export function mediaJobsFromBundle(manifest: MediaManifest, pathPrefix: string): MediaUploadJob[] {
  const jobs: MediaUploadJob[] = [];
  for (const [clientId, meta] of Object.entries(manifest)) {
    const rel = normalizeBundleZipPath(meta.path);
    const zipPath = manifestPathToZipKey(rel, pathPrefix);
    const filename = rel.split("/").pop() || clientId;
    jobs.push({ clientId, zipPath, filename });
  }
  jobs.sort((a, b) => a.zipPath.localeCompare(b.zipPath));
  return jobs;
}

export function bundlePathPrefixFromZip(zip: JSZip): string {
  return detectBundlePathPrefix(indexZipByPath(zip));
}
