"use client";

import { useI18n } from "@/components/I18nProvider";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span>{t("language")}</span>
      <div className="flex rounded-full border border-border bg-card p-1">
        <button
          className={`px-3 py-1 rounded-full transition ${
            lang === "en"
              ? "bg-accent text-white"
              : "text-muted hover:text-foreground"
          }`}
          onClick={() => setLang("en")}
          type="button"
        >
          EN
        </button>
        <button
          className={`px-3 py-1 rounded-full transition ${
            lang === "sv"
              ? "bg-accent text-white"
              : "text-muted hover:text-foreground"
          }`}
          onClick={() => setLang("sv")}
          type="button"
        >
          SV
        </button>
      </div>
    </div>
  );
}
