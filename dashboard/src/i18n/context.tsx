"use client";

import React, { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale, Translations } from "./types";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, SUPPORTED_LOCALES } from "./types";
import { ptBR } from "./locales/pt-BR";
import { en } from "./locales/en";

const dictionaries: Record<Locale, Translations> = {
  "pt-BR": ptBR,
  en,
};

interface I18nContextType {
  locale: Locale;
  t: Translations;
  setLocale: (newLocale: Locale) => void;
}

const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT_LOCALE,
  t: ptBR,
  setLocale: () => {},
});

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const router = useRouter();
  // The root layout reads the locale cookie on the server, so the first render already matches it.
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = (newLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    setLocaleState(newLocale);
    if (typeof document !== "undefined") {
      document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    }
    router.refresh();
  };

  const t = dictionaries[locale] || ptBR;

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      t: ptBR,
      setLocale: () => {},
    };
  }
  return context;
}
