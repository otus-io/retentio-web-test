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
