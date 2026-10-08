import { cookies } from "next/headers";
import type { Locale, Translations } from "./types";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, SUPPORTED_LOCALES } from "./types";
import { getDictionary } from "./dictionaries";

export async function getServerLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(LOCALE_COOKIE_NAME)?.value as Locale;
    if (cookieVal && SUPPORTED_LOCALES.includes(cookieVal)) {
      return cookieVal;
    }
  } catch {
    // Return default locale if outside request scope
  }
  return DEFAULT_LOCALE;
}

export async function getServerI18n(): Promise<{
  locale: Locale;
  t: Translations;
}> {
  const locale = await getServerLocale();
  return {
    locale,
    t: getDictionary(locale),
  };
}
