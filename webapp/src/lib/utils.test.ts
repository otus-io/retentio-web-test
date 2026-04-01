import { describe, it, expect } from "vitest";
import { cn, formatMediaMarkersForDisplay } from "./utils";

describe("cn", () => {
  it("merges class names with clsx", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });
});

describe("formatMediaMarkersForDisplay", () => {
  it("replaces [audio:id] with audio:id", () => {
    expect(formatMediaMarkersForDisplay("play [audio:abc123]")).toBe("play audio:abc123");
  });

  it("replaces [image:id] with image:id", () => {
    expect(formatMediaMarkersForDisplay("see [image:xyz789]")).toBe("see image:xyz789");
  });

  it("replaces [json:id] and [video:id]", () => {
    expect(formatMediaMarkersForDisplay("d [json:abc12]")).toBe("d json:abc12");
    expect(formatMediaMarkersForDisplay("[video:v1]")).toBe("video:v1");
  });

  it("replaces multiple markers", () => {
    expect(formatMediaMarkersForDisplay("[audio:a][image:b]")).toBe("audio:aimage:b");
  });

  it("returns unchanged string when no markers", () => {
    expect(formatMediaMarkersForDisplay("no markers")).toBe("no markers");
  });

  it("leaves bare audio:id and image:id unchanged", () => {
    expect(formatMediaMarkersForDisplay("audio:63ekundzy9 · image:qoiie6hldh")).toBe("audio:63ekundzy9 · image:qoiie6hldh");
  });
});
