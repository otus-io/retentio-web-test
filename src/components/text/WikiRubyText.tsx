import { Fragment, type ReactNode } from "react";
import { looksLikeWikiRubyMarkup, parseWikiRubyMarkup } from "@/lib/wikiRubyMarkup";

/** Renders `[[kanji|reading]]` wiki markup as HTML ruby (same convention as cards / mobile). */
export function WikiRubyText({ text }: { text: string }): ReactNode {
  if (!text) return null;
  if (!looksLikeWikiRubyMarkup(text)) return text;
  return (
    <>
      {parseWikiRubyMarkup(text).map((seg, i) =>
        seg.type === "plain" ? (
          <Fragment key={i}>{seg.text}</Fragment>
        ) : (
          <ruby key={i} className="[ruby-align:center]">
            {seg.main}
            <rt className="pb-0.5 text-[0.65em] font-normal text-muted-foreground tracking-tight">
              {seg.reading}
            </rt>
          </ruby>
        )
      )}
    </>
  );
}
