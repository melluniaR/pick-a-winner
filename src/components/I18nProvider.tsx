"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Language, translate } from "@/lib/i18n";

const I18nContext = createContext<{
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
} | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("paw-lang") as Language | null;
    if (saved) setLangState(saved);
  }, []);

  const setLang = (next: Language) => {
    setLangState(next);
    window.localStorage.setItem("paw-lang", next);
  };

  const t = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) =>
      translate(lang, key, vars);
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
