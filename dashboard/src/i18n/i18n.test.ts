import { describe, it, expect } from "vitest";
import { ptBR } from "./locales/pt-BR";
import { en } from "./locales/en";
import { formatNumber, formatKwh, formatKw, formatCurrency, formatRelativeTime, formatPortalDate, formatTariff, formatCurrencyEstimate } from "./formatters";

describe("i18n dictionaries", () => {
  it("has matching translation keys between pt-BR and en", () => {
    const ptKeys = Object.keys(ptBR).sort();
    const enKeys = Object.keys(en).sort();
    expect(ptKeys).toEqual(enKeys);

    for (const key of ptKeys as (keyof typeof ptBR)[]) {
      const ptSubKeys = Object.keys(ptBR[key]).sort();
      const enSubKeys = Object.keys(en[key]).sort();
      expect(ptSubKeys, `Missing keys in en.${key}`).toEqual(enSubKeys);
    }
  });

  it("does not have empty translation values in pt-BR or en", () => {
    for (const dictionary of [ptBR, en]) {
      for (const section of Object.values(dictionary)) {
        for (const val of Object.values(section)) {
          const texts = Array.isArray(val) ? val : [val];
          expect(texts.length).toBeGreaterThan(0);
          for (const text of texts) {
            expect(typeof text).toBe("string");
            expect((text as string).length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("has twelve short month names in each language", () => {
    expect(ptBR.common.monthsShort).toHaveLength(12);
    expect(en.common.monthsShort).toHaveLength(12);
    expect(en.common.monthsShort[1]).toBe("Feb");
    expect(ptBR.common.monthsShort[1]).toBe("Fev");
  });
});

describe("i18n formatters", () => {
  it("formats numbers according to locale", () => {
    const val = 1234.56;
    expect(formatNumber(val, "pt-BR")).toBe("1.234,56");
    expect(formatNumber(val, "en")).toBe("1,234.56");
  });

  it("formats kWh and kW correctly", () => {
    expect(formatKwh(50.4, "pt-BR")).toBe("50,4 kWh");
    expect(formatKwh(50.4, "en")).toBe("50.4 kWh");
    expect(formatKw(12.34, "pt-BR")).toBe("12,34 kW");
    expect(formatKw(12.34, "en")).toBe("12.34 kW");
  });

  it("formats currency in BRL for both locales", () => {
    const pt = formatCurrency(150.5, "pt-BR");
    const enVal = formatCurrency(150.5, "en");
    expect(pt).toContain("R$");
    expect(enVal).toContain("R$");
  });

  it("formats relative time correctly in pt-BR and en", () => {
    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60000);
    expect(formatRelativeTime(tenMinAgo, "pt-BR")).toBe("há 10 min");
    expect(formatRelativeTime(tenMinAgo, "en")).toBe("10m ago");

    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);
    expect(formatRelativeTime(twoHoursAgo, "pt-BR")).toBe("há 2 horas");
    expect(formatRelativeTime(twoHoursAgo, "en")).toBe("2h ago");
  });

  it("formats tariffs with three decimals and estimates in whole reais", () => {
    expect(formatTariff(0.75773, "en")).toBe("R$0.758");
    expect(formatTariff(0.75773, "pt-BR")).toBe("R$ 0,758");
    expect(formatCurrencyEstimate(7501.53, "en")).toBe("R$7,502");
    expect(formatCurrencyEstimate(7501.53, "pt-BR")).toBe("R$ 7.502");
  });

  it("formats utility portal dates per locale", () => {
    expect(formatPortalDate("13/10/2026 00:00:00", "pt-BR")).toBe("13/10/2026");
    expect(formatPortalDate("13/10/2026", "en")).toBe("Oct 13, 2026");
    expect(formatPortalDate("09/2026", "en")).toBe("Sep 2026");
    expect(formatPortalDate(undefined, "en")).toBe("—");
    expect(formatPortalDate("next cycle", "en")).toBe("next cycle");
  });
});
