import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { ptBR, type TranslationKeys } from "./translations/pt-BR";
import { en } from "./translations/en";
import { de } from "./translations/de";

export type Language = "pt-BR" | "en" | "de";

export const languageLabels: Record<Language, string> = {
  "pt-BR": "Português",
  en: "English",
  de: "Deutsch",
};

export const languageFlags: Record<Language, string> = {
  "pt-BR": "🇧🇷",
  en: "🇺🇸",
  de: "🇩🇪",
};

const translations: Record<Language, TranslationKeys> = {
  "pt-BR": ptBR,
  en,
  de,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function getSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem("app_language");
    if (saved === "pt-BR" || saved === "en" || saved === "de") return saved;
  } catch {}
  return "pt-BR";
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLang] = useState<Language>(getSavedLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    localStorage.setItem("app_language", lang);
  }, []);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
