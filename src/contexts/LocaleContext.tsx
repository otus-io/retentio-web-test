import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { HomeLang } from "@/locales/home";

const LOCALE_KEY = "wordupx_locale";

interface LocaleContextValue {
  lang: HomeLang;
  setLang: (lang: HomeLang) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLang(): HomeLang {
  const s = localStorage.getItem(LOCALE_KEY);
  if (s === "zh" || s === "en" || s === "ja" || s === "de") return s;
  return "en";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<HomeLang>(readStoredLang);

  const setLang = useCallback((l: HomeLang) => {
    setLangState(l);
    localStorage.setItem(LOCALE_KEY, l);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("lang");
    if (q === "zh" || q === "en" || q === "ja" || q === "de") {
      setLangState(q);
      localStorage.setItem(LOCALE_KEY, q);
    }
  }, []);

  return (
    <LocaleContext.Provider value={{ lang, setLang }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
