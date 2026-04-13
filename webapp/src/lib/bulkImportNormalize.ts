/**
 * Bulk-import ZIP path helpers (layout checks for BulkUploadPage).
 */

export function normalizeZipPath(name: string): string {
  return name.replace(/\\/g, "/").trim();
}

const BULK_MEDIA_FOLDERS = new Set(["audio", "image", "video", "json"]);

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
    [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(e) ||
    [".mov", ".webm"].includes(e) ||
    e === ".json"
  );
}

/** True for media files directly under audio/, image/, video/, or json/ (no nesting). */
export function bulkImportZipEntryIsMedia(name: string): boolean {
  const norm = normalizeZipPath(name);
  if (bulkImportZipPathSkippable(norm)) return false;
  const parts = norm.split("/").filter(Boolean);
  if (parts.length !== 2) return false;
  const folder = parts[0].toLowerCase();
  if (!BULK_MEDIA_FOLDERS.has(folder)) return false;
  const base = parts[1];
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot) : "";
  return bulkImportMediaExtOk(ext);
}

/** Normalized forward-slash paths of all media entries in the ZIP. */
export function listBulkImportMediaPaths(zipEntryPaths: string[]): string[] {
  const out: string[] = [];
  for (const raw of zipEntryPaths) {
    if (!bulkImportZipEntryIsMedia(raw)) continue;
    out.push(normalizeZipPath(raw));
  }
  return out;
}
