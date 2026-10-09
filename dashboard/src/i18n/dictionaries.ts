import type { Locale, Translations } from "./types";
import { ptBR } from "./locales/pt-BR";
import { en } from "./locales/en";

export const dictionaries: Record<Locale, Translations> = { "pt-BR": ptBR, en };

export function getDictionary(locale: Locale): Translations {
  return dictionaries[locale] ?? ptBR;
}
