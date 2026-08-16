/** Strip [[kanji|reading]] ruby markup. */
const RUBY_RE = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

/** Written form (kanji); matches quality-tools CLI surface_form. */
export function surfaceForm(text: string): string {
  return text.replace(RUBY_RE, "$1").trim();
}

/** Reading form (hiragana) for TTS pronunciation; spaces removed. */
export function readingForm(text: string): string {
  return text.replace(RUBY_RE, "$2").replace(/\s+/g, "").trim();
}
