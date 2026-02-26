import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const MEDIA_MARKER_RE = /\[(audio|image):([a-z0-9]+)\]/g;

/** Format [audio:id] / [image:id] as "audio:id" / "image:id" for display. */
export function formatMediaMarkersForDisplay(text: string): string {
  return text.replace(MEDIA_MARKER_RE, (_, type, id) => `${type}:${id}`);
}
