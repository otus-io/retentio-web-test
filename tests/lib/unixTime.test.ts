import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelativePast, formatUnixSecondsUtc, nowUnixSecondsUtc } from "@/lib/unixTime";

describe("formatUnixSecondsUtc", () => {
  it("returns em dash for zero", () => {
    expect(formatUnixSecondsUtc(0)).toBe("—");
  });

  it("returns em dash for negative values", () => {
    expect(formatUnixSecondsUtc(-1)).toBe("—");
  });

  it("returns ISO-8601 UTC with Z suffix for positive seconds", () => {
    expect(formatUnixSecondsUtc(1_700_000_000)).toBe(new Date(1_700_000_000 * 1000).toISOString());
    expect(formatUnixSecondsUtc(1_700_000_000)).toMatch(/Z$/);
  });
});

describe("nowUnixSecondsUtc", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T12:00:00.500Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns whole seconds floored from Date.now()", () => {
    expect(nowUnixSecondsUtc()).toBe(Math.floor(Date.now() / 1000));
  });
});

describe("formatRelativePast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns just now for under a minute", () => {
    expect(formatRelativePast("2026-04-25T11:59:30Z")).toBe("just now");
  });

  it("returns minutes, hours, and days", () => {
    expect(formatRelativePast("2026-04-25T11:55:00Z")).toBe("5m");
    expect(formatRelativePast("2026-04-25T10:00:00Z")).toBe("2h");
    expect(formatRelativePast("2026-04-24T12:00:00Z")).toBe("1d");
  });

  it("returns em dash for invalid input", () => {
    expect(formatRelativePast("not-a-date")).toBe("—");
  });
});
