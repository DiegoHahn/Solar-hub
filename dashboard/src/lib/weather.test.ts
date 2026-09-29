import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyWeatherRow } from "./types";

vi.mock("./queries", () => ({
  getGenerationByDay: vi.fn(),
  getStoredDailyWeather: vi.fn(),
  saveDailyWeather: vi.fn(),
}));

import { getGenerationByDay, getStoredDailyWeather, saveDailyWeather } from "./queries";
import { fallbackDailyWeather, parseWmoCode } from "./weather";
import { getIcaraWeatherData } from "./weatherData";

describe("parseWmoCode", () => {
  it.each([
    [0, "Céu Limpo", "sun"],
    [1, "Ensolarado", "sun"],
    [2, "Parcialmente Nublado", "cloud-sun"],
    [3, "Nublado / Encoberto", "cloud"],
    [45, "Nevoeiro", "cloud"],
    [53, "Garoa / Chuvisco", "rain"],
    [63, "Chuva Contínua", "rain"],
    [81, "Pancadas de Chuva", "rain"],
    [95, "Tempestade", "storm"],
    [71, "Variação de Nuvens", "cloud-sun"],
  ])("código %d -> %s (%s)", (code, condition, icon) => {
    expect(parseWmoCode(code)).toEqual({ condition, icon });
  });
});

describe("getIcaraWeatherData", () => {
  // Agora simulado: 25/09/2026 12h em Brasília -> janela de 90 dias a partir de 27/06; recente a partir de 18/09
  const NOW = new Date("2026-09-25T12:00:00-03:00");

  const row = (date: string, overrides: Partial<DailyWeatherRow> = {}): DailyWeatherRow => ({
    date,
    weather_code: 1,
    temperature_max_c: 25,
    temperature_min_c: 15,
    sunshine_duration_s: 30000,
    shortwave_radiation_mj: 18,
    precipitation_mm: 0,
    source: "archive",
    ...overrides,
  });

  const daily = (days: Array<[string, number | null, number]>) => ({
    daily: {
      time: days.map(([d]) => d),
      weather_code: days.map(([, , code]) => code),
      temperature_2m_max: days.map(() => 28.1),
      temperature_2m_min: days.map(() => 15.2),
      sunshine_duration: days.map(() => 36000),
      shortwave_radiation_sum: days.map(([, rad]) => rad),
      precipitation_sum: days.map(() => 0),
    },
  });

  const olderDates = () => {
    const dates: string[] = [];
    for (let d = new Date("2026-06-27T00:00:00Z"); d < new Date("2026-09-18T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  };

  const mockFetch = (handler: (url: string) => unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = handler(url);
        return body ? { ok: true, json: async () => body } : { ok: false };
      }),
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.mocked(getStoredDailyWeather).mockResolvedValue([]);
    vi.mocked(getGenerationByDay).mockResolvedValue({});
    vi.mocked(saveDailyWeather).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("na carga inicial completa pela Archive API os dias sem radiação no forecast e não grava dias nulos", async () => {
    mockFetch((url) =>
      url.includes("archive-api")
        ? daily([["2026-06-27", 7.2, 61], ["2026-06-28", 18, 0]])
        : daily([["2026-06-27", null, 61], ["2026-09-24", 18, 0], ["2026-09-25", 7.2, 61]]),
    );
    vi.mocked(getGenerationByDay).mockResolvedValue({
      "2026-06-28": { kwh: 30, isReal: false },
      "2026-09-24": { kwh: 71.26, isReal: true },
    });

    const result = await getIcaraWeatherData();

    const saved = vi.mocked(saveDailyWeather).mock.calls[0][0];
    expect(saved.map((r) => [r.date, r.source])).toEqual([
      ["2026-09-24", "forecast"],
      ["2026-09-25", "forecast"],
      ["2026-06-27", "archive"],
      ["2026-06-28", "archive"],
    ]);

    expect(result.map((d) => d.date)).toEqual(["2026-06-27", "2026-06-28", "2026-09-24", "2026-09-25"]);
    const [jun27, jun28, sep24, today] = result;

    // Sem geração registrada: estimativa = 16 kWp × HSP × 0.81 (7.2 MJ = 2 HSP)
    expect(jun27).toMatchObject({ condition: "Chuva Contínua", solarRadiationHsp: 2, estimatedKwh: 25.9, isReal: false });
    // Fechamento estimado: usa o kWh registrado, mas sem selo de medição real
    expect(jun28).toMatchObject({ estimatedKwh: 30, isReal: false, realKwh: undefined });
    expect(sep24).toMatchObject({
      dayOfWeek: "Qui",
      formattedDate: "24/09",
      sunshineHours: 10,
      solarRadiationHsp: 5,
      estimatedKwh: 71.3,
      isReal: true,
      realKwh: 71.3,
    });
    expect(today.formattedDate).toBe("Hoje");
  });

  it("com o histórico armazenado rebusca só a janela recente e regrava apenas os dias alterados", async () => {
    vi.mocked(getStoredDailyWeather).mockResolvedValue([
      ...olderDates().map((d) => row(d)),
      row("2026-09-24", { source: "forecast", weather_code: 0, temperature_max_c: 28.1, temperature_min_c: 15.2, sunshine_duration_s: 36000 }),
    ]);
    mockFetch(() => daily([["2026-09-24", 18, 0], ["2026-09-25", 7.2, 61]]));

    const result = await getIcaraWeatherData();

    const calls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("past_days=7");

    const saved = vi.mocked(saveDailyWeather).mock.calls[0][0];
    expect(saved.map((r) => r.date)).toEqual(["2026-09-25"]);
    expect(result[result.length - 1]).toMatchObject({ date: "2026-09-25", formattedDate: "Hoje" });
    expect(result).toHaveLength(olderDates().length + 2);
  });

  it("devolve o fallback quando não há clima armazenado e a Open-Meteo falha", async () => {
    mockFetch(() => null);

    await expect(getIcaraWeatherData()).resolves.toBe(fallbackDailyWeather);
  });
});
