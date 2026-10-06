import type { Locale } from "./types";
import { DEFAULT_LOCALE } from "./types";

export function formatNumber(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions,
): string {
  const intlLocale = locale === "pt-BR" ? "pt-BR" : "en-US";
  return new Intl.NumberFormat(intlLocale, options).format(value);
}

export function formatKwh(value: number, locale: Locale = DEFAULT_LOCALE): string {
  return `${formatNumber(value, locale, { maximumFractionDigits: 1 })} kWh`;
}

export function formatKw(value: number, locale: Locale = DEFAULT_LOCALE): string {
  return `${formatNumber(value, locale, { maximumFractionDigits: 2 })} kW`;
}

export function formatCurrency(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
  currency = "BRL",
): string {
  const intlLocale = locale === "pt-BR" ? "pt-BR" : "en-US";
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency,
  }).format(value);
}

export function formatRelativeTime(
  dateInput: Date | string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInMinutes = Math.round((now.getTime() - date.getTime()) / 60000);

  if (diffInMinutes < 1) {
    return locale === "pt-BR" ? "agora mesmo" : "just now";
  }

  if (diffInMinutes < 60) {
    return locale === "pt-BR" ? `há ${diffInMinutes} min` : `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.round(diffInMinutes / 60);
  if (diffInHours < 24) {
    return locale === "pt-BR"
      ? `há ${diffInHours} ${diffInHours === 1 ? "hora" : "horas"}`
      : `${diffInHours}h ago`;
  }

  const diffInDays = Math.round(diffInHours / 24);
  if (diffInDays === 1) {
    return locale === "pt-BR" ? "ontem" : "yesterday";
  }

  return locale === "pt-BR" ? `há ${diffInDays} dias` : `${diffInDays}d ago`;
}

export function interpolate(
  template: string,
  variables: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return key in variables ? String(variables[key]) : `{${key}}`;
  });
}
