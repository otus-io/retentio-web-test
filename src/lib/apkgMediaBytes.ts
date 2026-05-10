import { decompress } from "fzstd";

/** Zstandard frame magic (same as Anki apkg compressed media members). */
export function isLikelyZstdCompressed(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const u = new Uint8Array(buf);
  return u[0] === 0x28 && u[1] === 0xb5 && u[2] === 0x2f && u[3] === 0xfd;
}

/**
 * Anki 25+ may store media zip members zstd-compressed; API can still serve those bytes
 * as audio/image/video. Decompress so browsers can decode the inner file.
 */
export function decompressApkgMediaMemberIfZstd(buf: ArrayBuffer): ArrayBuffer {
  if (!isLikelyZstdCompressed(buf)) return buf;
  const out = decompress(new Uint8Array(buf));
  const copy = new ArrayBuffer(out.byteLength);
  new Uint8Array(copy).set(out);
  return copy;
}
