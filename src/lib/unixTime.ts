/**
 * Card and deck APIs use Unix timestamps: whole seconds since 1970-01-01T00:00:00Z (UTC epoch).
 * Instants are timezone-agnostic; always format for users in UTC so all clients match the server clock.
 */

export function nowUnixSecondsUtc(): number {
  return Math.floor(Date.now() / 1000);
}

/** ISO-8601 UTC (ends with `Z`). */
export function formatUnixSecondsUtc(sec: number): string {
  if (sec <= 0) return "—";
  return new Date(sec * 1000).toISOString();
}

/**
 * Compact relative past label for UI (e.g. contribution submitted time):
 * `just now`, `5m`, `1h`, `1d`, then a short UTC date.
 */
export function formatRelativePast(
  input: string | number | Date,
  nowMs: number = Date.now()
): string {
  const d =
    input instanceof Date
      ? input
      : typeof input === "number"
        ? new Date(input > 1e12 ? input : input * 1000)
        : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = nowMs - d.getTime();
  if (diffMs < 0) return "just now";
  const diffM = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);
  if (diffM < 1) return "just now";
  if (diffM < 60) return `${diffM}m`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString(undefined, {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
