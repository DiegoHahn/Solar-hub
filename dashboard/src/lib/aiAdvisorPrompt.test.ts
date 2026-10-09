import { describe, expect, it } from "vitest";

import { buildAdvisorPrompt, type AdvisorPromptData } from "./aiAdvisorPrompt";
import { normalizeUnidadeConsumidora } from "./queries";
import { findGeneratorUcCode } from "./utility";
import type { DailyWeather } from "./weather";
import type { SolarTelemetryRow, SunCurvePoint, UnidadeConsumidora, UtilityDataRow } from "./types";

import utilityFixture from "../test/fixtures/utility-data.json";

const DAYTIME = new Date("2026-09-29T14:30:00-03:00");
const NIGHTTIME = new Date("2026-09-29T21:15:00-03:00");

const utilityData = (() => {
  const raw = utilityFixture as unknown as UtilityDataRow;
  const code = findGeneratorUcCode(raw.unidades_consumidoras)!;
  return {
    ...raw,
    generator_uc: code,
    unidades_consumidoras: {
      ...raw.unidades_consumidoras,
      [code]: normalizeUnidadeConsumidora(raw.unidades_consumidoras[code] as UnidadeConsumidora),
    },
  };
})();

const telemetry = {
  total_power_kw: 9.84,
  total_today_kwh: 42.3,
  inverters_count: 3,
} as unknown as SolarTelemetryRow;

const sunCurve: SunCurvePoint[] = [
  { time: "11:00", power_kw: 10.2, nominal_cap_kw: 16, solis_kw: 3, goodwe1_kw: 3.6, goodwe2_kw: 3.6 },
  { time: "12:30", power_kw: 12.7, nominal_cap_kw: 16, solis_kw: 4, goodwe1_kw: 4.35, goodwe2_kw: 4.35 },
  { time: "15:00", power_kw: null, nominal_cap_kw: 16, solis_kw: null, goodwe1_kw: null, goodwe2_kw: null },
];

const day = (overrides: Partial<DailyWeather>): DailyWeather => ({
  date: "2026-09-28",
  isToday: false,
  weatherCode: 0,
  conditionKey: "clearSky",
  icon: "sun",
  tempMax: 27,
  tempMin: 15,
  sunshineHours: 10.5,
  solarRadiationHsp: 6,
  precipitationMm: 0,
  estimatedKwh: 90,
  isReal: true,
  ...overrides,
});

const weatherHistory: DailyWeather[] = [
  day({ date: "2026-09-27", estimatedKwh: 80 }),
  day({ date: "2026-09-28", estimatedKwh: 100 }),
  day({ date: "2026-09-26", solarRadiationHsp: 2, estimatedKwh: 20 }),
  day({
    date: "2026-09-29",
    isToday: true,
    conditionKey: "partlyCloudy",
    sunshineHours: 6.2,
    solarRadiationHsp: 4.1,
    precipitationMm: 1.4,
    tempMax: 24,
  }),
];

const fullData: AdvisorPromptData = { telemetry, utilityData, sunCurve, weatherHistory };
const emptyData: AdvisorPromptData = { telemetry: null, utilityData: null, sunCurve: [], weatherHistory: [] };

describe("buildAdvisorPrompt", () => {
  it("asks for answers in the display language", () => {
    expect(buildAdvisorPrompt(fullData, "en", DAYTIME)).toContain(
      "Write ALL text values of the response in fluent, professional US English.",
    );
    expect(buildAdvisorPrompt(fullData, "pt-BR", DAYTIME)).toContain(
      "Write ALL text values of the response in Brazilian Portuguese (pt-BR).",
    );
  });

  it("describes today's generation as partial while the sun is up", () => {
    const prompt = buildAdvisorPrompt(fullData, "en", DAYTIME);

    expect(prompt).toContain("Current analysis time: 14:30 (Brasília time).");
    expect(prompt).toContain("THE DAY IS STILL IN PROGRESS (daytime). The plant is running and producing 9.8 kW right now.");
    expect(prompt).toContain("Production accumulated until 14:30: 42.3 kWh (partial, day in progress)");
    expect(prompt).toContain("Generating during daytime (9.8 kW right now)");
    expect(prompt).not.toContain("NIGHTTIME");
  });

  it("treats today's generation as final after sunset", () => {
    const prompt = buildAdvisorPrompt(fullData, "en", NIGHTTIME);

    expect(prompt).toContain("NIGHTTIME (daytime generation finished): it is 21:15 and the sun has set.");
    expect(prompt).toContain("42.3 kWh (final total for the day)");
    expect(prompt).not.toContain("THE DAY IS STILL IN PROGRESS");
  });

  it("injects today's weather, the sunny-day reference and the peak of the sun curve", () => {
    const prompt = buildAdvisorPrompt(fullData, "pt-BR", DAYTIME);

    expect(prompt).toContain("* Condition: Partly Cloudy");
    expect(prompt).toContain("* Effective full sun hours: 6.2 h");
    expect(prompt).toContain("* Solar irradiation (HSP): 4.1 kWh/m²");
    expect(prompt).toContain("* Accumulated rain: 1.4 mm");
    expect(prompt).toContain("* Maximum temperature: 24°C");
    // Average of the measured, completed days with HSP >= 4.5 (80 and 100 kWh)
    expect(prompt).toContain("daily production averages about 90.0 kWh.");
    expect(prompt).toContain("Peak power recorded today: 12.7 kW at 12:30");
  });

  it("includes tariff, savings and the utility credit balance when available", () => {
    const prompt = buildAdvisorPrompt(fullData, "en", DAYTIME);
    const uc = utilityData.unidades_consumidoras[utilityData.generator_uc];
    const balance = uc.geracao_distribuida?.ValorProximoSaldoVencer;

    expect(prompt).toContain("Tariff: R$ 0.758/kWh.");
    expect(prompt).toContain(`(accumulated savings: R$ ${(42.3 * 0.75773).toFixed(2)})`);
    expect(prompt).toContain(
      `Total credit balance accumulated with the cooperative: ${balance} kWh (estimated reserve of R$ ${Math.round(balance! * 0.75773)}).`,
    );
  });

  it("tells the model not to infer anything that is missing", () => {
    const prompt = buildAdvisorPrompt(emptyData, "en", DAYTIME);

    expect(prompt).toContain("Weather measured in Içara today: not available (do not infer weather conditions).");
    expect(prompt).toContain("no complete sunny day in the recent history; do not compare with a typical day.");
    expect(prompt).toContain("Tariff: not available (do not estimate savings in reais).");
    expect(prompt).toContain("not available (do not estimate the reserve).");
    expect(prompt).toContain("Solar plant: 16 kWp (3 inverters)");
    expect(prompt).toContain("Peak power recorded today: 0.0 kW  (out of 16 kWp installed capacity)");
    expect(prompt).not.toContain("accumulated savings");
  });

  it("ends with the strict JSON contract for the daily and monthly analyses", () => {
    const prompt = buildAdvisorPrompt(fullData, "en", DAYTIME);

    expect(prompt).toContain("Return ONLY the following strict JSON");
    expect(prompt).toContain('"daily": {');
    expect(prompt).toContain('"monthly": {');
    expect(prompt.trimEnd().endsWith("}")).toBe(true);
  });
});
