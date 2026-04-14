import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const MEDIA_MARKER_RE = /\[(audio|image|video|json):([^\]]+)\]/g;

/** Format bracket media markers as bare "type:id" for display. Bare markers left as-is. */
export function formatMediaMarkersForDisplay(text: string): string {
  return text.replace(MEDIA_MARKER_RE, (_, type, id) => `${type}:${id}`);
}
