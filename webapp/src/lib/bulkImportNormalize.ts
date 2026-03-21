/**
 * Bulk-import ZIP preview helpers. Must stay aligned with retentio-backend/api/deck BulkImport
 * media rules (hybrid matching from any cell).
 */

export function normalizeZipPath(name: string): string {
  return name.replace(/\\/g, "/").trim();
}

export function bulkImportZipPathSkippable(name: string): boolean {
  const norm = normalizeZipPath(name);
  if (!norm || norm.endsWith("/")) return true;
  const base = norm.split("/").pop() ?? "";
  const lower = base.toLowerCase();
  if (lower === ".ds_store" || lower === "thumbs.db" || lower === "desktop.ini") return true;
  if (base.startsWith("._")) return true;
  return norm.split("/").some((p) => p.toLowerCase() === "__macosx");
}

export function bulkImportMediaExtOk(ext: string): boolean {
  const e = ext.toLowerCase();
  return (
    [".mp3", ".wav", ".ogg", ".m4a", ".mp4"].includes(e) ||
    [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(e)
  );
}

export function bulkImportZipEntryIsMedia(name: string): boolean {
  const norm = normalizeZipPath(name);
  if (bulkImportZipPathSkippable(norm)) return false;
  const base = norm.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot) : "";
  return bulkImportMediaExtOk(ext);
}

/** Normalized forward-slash paths of all media entries in the ZIP (for preview + exact match). */
export function listBulkImportMediaPaths(zipEntryPaths: string[]): string[] {
  const out: string[] = [];
  for (const raw of zipEntryPaths) {
    if (!bulkImportZipEntryIsMedia(raw)) continue;
    out.push(normalizeZipPath(raw));
  }
  return out;
}

/** True if cell text exactly equals basename, full path, or path with backslashes normalized. */
export function bulkImportCellMatchesMedia(cell: string, zipPath: string, base: string): boolean {
  const stem = (() => {
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(0, dot) : base;
  })();
  for (const c of bulkImportCellCandidates(cell)) {
    if (c === base || c === zipPath || c === stem) return true;
  }
  return false;
}

function bulkImportCellCandidates(cell: string): string[] {
  const raw = cell.trim();
  if (!raw) return [];
  const set = new Set<string>();
  set.add(raw);
  set.add(normalizeZipPath(raw));
  const dot = raw.lastIndexOf(".");
  if (dot > 0) set.add(raw.slice(0, dot));

  const sound = raw.match(/\[sound:([^\]]+)\]/i);
  if (sound?.[1]) {
    const fn = sound[1].trim();
    if (fn) {
      set.add(fn);
      set.add(normalizeZipPath(fn));
      const d = fn.lastIndexOf(".");
      if (d > 0) set.add(fn.slice(0, d));
    }
  }

  const reading = bulkImportRubyReading(raw);
  if (reading) set.add(reading);
  return [...set];
}

function bulkImportRubyReading(cell: string): string {
  const s = cell.trim().replace(/ /g, "").replace(/　/g, "");
  if (!s) return "";
  let out = "";
  let inBracket = false;
  for (const ch of s) {
    if (ch === "[") {
      inBracket = true;
      continue;
    }
    if (ch === "]") {
      inBracket = false;
      continue;
    }
    if (inBracket) {
      out += ch;
      continue;
    }
    // Keep kana outside brackets, so 青[あお]い -> あおい.
    if (/[\u3040-\u309f\u30a0-\u30ffー]/u.test(ch)) out += ch;
  }
  if (out !== "") {
    // Avoid matching both あれ.mp3 and あれ？.mp3 when the cell is あれ？ (ruby-only kana was あれ).
    if (s.endsWith(`${out}？`)) out += "？";
    else if (s.endsWith(`${out}?`)) out += "?";
  }
  return out;
}

/**
 * Preview text for the media column: per CSV cell, basenames of ZIP files that match **only** that cell
 * (same rules as backend). Non-empty cells are joined with "; " (e.g. headword image + gloss image).
 */
export function formatMatchedMediaForRow(values: string[], mediaPaths: string[]): string {
  const cellParts: string[] = [];
  for (const v of values) {
    const matched: string[] = [];
    const seen = new Set<string>();
    for (const rawPath of mediaPaths) {
      const path = normalizeZipPath(rawPath);
      const base = path.split("/").pop() ?? "";
      if (bulkImportCellMatchesMedia(v, path, base) && !seen.has(path)) {
        seen.add(path);
        matched.push(base);
      }
    }
    if (matched.length > 0) {
      cellParts.push(matched.join(", "));
    }
  }
  return cellParts.join("; ");
}

/** Normalized ZIP paths for media referenced by at least one preview row (union across rows). */
export function listMatchedMediaPathsForPreview(
  rows: { values: string[] }[],
  mediaPaths: string[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rawPath of mediaPaths) {
    const path = normalizeZipPath(rawPath);
    const base = path.split("/").pop() ?? "";
    let hit = false;
    for (const row of rows) {
      for (const v of row.values) {
        if (bulkImportCellMatchesMedia(v, path, base)) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (hit && !seen.has(path)) {
      seen.add(path);
      out.push(path);
    }
  }
  return out;
}
