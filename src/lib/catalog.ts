import { getCatalogDeck } from "@/lib/api";

export function formatCatalogPublishedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Load one public catalog deck (GET /api/decks/catalog/{id}). */
export async function fetchCatalogDeckById(id: string, token?: string | null) {
  const res = await getCatalogDeck(id, token);
  return res.data;
}
