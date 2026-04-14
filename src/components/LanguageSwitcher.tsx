import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { LANGUAGES } from "@/locales/home";

export function LanguageSwitcher() {
  const { lang, setLang } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLabel = LANGUAGES.find((l) => l.code === lang)?.label ?? lang;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-input bg-muted/50 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select language"
      >
        <span>{currentLabel}</span>
        <svg
          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <ul
          className="absolute right-0 top-full z-50 mt-1 max-h-64 w-40 overflow-y-auto rounded-md border border-input bg-card py-1 shadow-lg"
          role="listbox"
        >
          {LANGUAGES.map(({ code, label }) => (
            <li key={code} role="option" aria-selected={lang === code}>
              <button
                type="button"
                onClick={() => {
                  setLang(code);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                  lang === code ? "bg-accent font-medium" : ""
                }`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
