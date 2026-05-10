/**
 * Reads `deck` from Anki export `export_meta.json` (or any JSON with the same shape)
 * for prefilling Retentio deck creation.
 */
export interface ParsedExportMetaDeck {
  name: string;
  fields: string[];
  rate: number;
}

export function parseExportMetaDeck(data: unknown): ParsedExportMetaDeck {
  if (data === null || typeof data !== "object") {
    throw new Error("JSON must be an object");
  }
  const root = data as Record<string, unknown>;
  const deck = root.deck;
  if (deck === null || typeof deck !== "object") {
    throw new Error('Missing "deck" object (expected export_meta.json)');
  }
  const d = deck as Record<string, unknown>;

  const name = typeof d.name === "string" ? d.name.trim() : "";
  if (!name) {
    throw new Error('deck.name is missing or empty');
  }

  const fieldsRaw = d.fields;
  if (!Array.isArray(fieldsRaw)) {
    throw new Error('deck.fields must be an array');
  }
  const fields = fieldsRaw
    .map((x) => (typeof x === "string" ? x.trim() : String(x)))
    .filter((s) => s.length > 0);
  if (fields.length < 1) {
    throw new Error("deck.fields must contain at least one non-empty name");
  }

  let rate = 20;
  if (d.rate !== undefined && d.rate !== null) {
    const n = typeof d.rate === "number" ? d.rate : parseInt(String(d.rate), 10);
    if (!Number.isFinite(n) || n < 1 || n > 1000) {
      throw new Error("deck.rate must be a number from 1 to 1000");
    }
    rate = n;
  }

  return { name, fields, rate };
}
