/** Same rule as `retentio-frontend` `WikiRubyMarkup`: `[[<main>|<reading>]]` */

export type WikiSegPlain = { type: "plain"; text: string };
export type WikiSegRuby = { type: "ruby"; main: string; reading: string };
export type WikiSeg = WikiSegPlain | WikiSegRuby;

const WIKI_RUBY_PAIR = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

export function looksLikeWikiRubyMarkup(s: string): boolean {
  return /\[\[([^\]|]+)\|([^\]]+)\]\]/.test(s);
}

export function parseWikiRubyMarkup(input: string): WikiSeg[] {
  const segments: WikiSeg[] = [];
  WIKI_RUBY_PAIR.lastIndex = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKI_RUBY_PAIR.exec(input)) !== null) {
    if (m.index > i) {
      const t = input.slice(i, m.index);
      if (t.length) segments.push({ type: "plain", text: t });
    }
    const main = m[1] ?? "";
    const reading = m[2] ?? "";
    if (main && reading) {
      segments.push({ type: "ruby", main, reading });
    } else {
      const literal = m[0];
      if (literal.length) segments.push({ type: "plain", text: literal });
    }
    i = m.index + m[0].length;
  }
  if (i < input.length) {
    const t = input.slice(i);
    if (t.length) segments.push({ type: "plain", text: t });
  }
  if (segments.length === 0) {
    return [{ type: "plain", text: input }];
  }
  return segments;
}
