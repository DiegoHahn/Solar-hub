import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyWeatherRow } from "./types";

vi.mock("./queries", () => ({
  getGenerationByDay: vi.fn(),
  getStoredDailyWeather: vi.fn(),
  saveDailyWeather: vi.fn(),
}));

import { getGenerationByDay, getStoredDailyWeather, saveDailyWeather } from "./queries";
import { fallbackDailyWeather, parseWmoCode, specificYield, type DailyWeather } from "./weather";
import { getIcaraWeatherData } from "./weatherData";

describe("parseWmoCode", () => {
  it.each([
    [0, "clearSky", "sun"],
    [1, "sunny", "sun"],
    [2, "partlyCloudy", "cloud-sun"],
    [3, "overcast", "cloud"],
    [45, "foggy", "cloud"],
    [53, "drizzle", "rain"],
    [63, "continuousRain", "rain"],
    [81, "rainShowers", "rain"],
    [95, "thunderstorm", "storm"],
    [71, "cloudVariation", "cloud-sun"],
  ])("code %d -> %s (%s)", (code, conditionKey, icon) => {
    expect(parseWmoCode(code)).toEqual({ conditionKey, icon });
  });
});

const day = (overrides: Partial<DailyWeather>): DailyWeather => ({
  ...fallbackDailyWeather[0],
  isReal: true,
  ...overrides,
});

describe("specificYield", () => {
  it("averages measured kWh per installed kWp per day", () => {
    const result = specificYield([day({ estimatedKwh: 64 }), day({ estimatedKwh: 80 })]);

    expect(result).toEqual({ kwhPerKwpDay: 4.5, measuredDays: 2 });
  });

  it("ignores estimated days and today", () => {
    const result = specificYield([
      day({ estimatedKwh: 64 }),
      day({ estimatedKwh: 70, isReal: false }),
      day({ estimatedKwh: 10, isToday: true }),
    ]);

    expect(result).toEqual({ kwhPerKwpDay: 4, measuredDays: 1 });
  });

  it("returns null when the period has no measured days", () => {
    expect(specificYield([day({ isReal: false })])).toBeNull();
    expect(specificYield([])).toBeNull();
  });
});

describe("getIcaraWeatherData", () => {
  // Simulated current time: 2026-09-25 12:00 BRT -> 90-day window starting 2026-06-27; recent window starting 2026-09-18
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

  it("completes initial load via Archive API for days missing radiation in forecast and omits null days", async () => {
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

    // Without recorded generation: estimate = 16 kWp * HSP * 0.81 (7.2 MJ = 2 HSP)
    expect(jun27).toMatchObject({ conditionKey: "continuousRain", solarRadiationHsp: 2, estimatedKwh: 25.9, isReal: false });
    // Estimated closure: uses recorded kWh, but without actual measurement flag
    expect(jun28).toMatchObject({ estimatedKwh: 30, isReal: false, realKwh: undefined });
    expect(sep24).toMatchObject({
      isToday: false,
      sunshineHours: 10,
      solarRadiationHsp: 5,
      estimatedKwh: 71.3,
      isReal: true,
      realKwh: 71.3,
    });
    expect(today.isToday).toBe(true);
  });

  it("with stored history, only refetches recent window and rewrites only changed days", async () => {
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
    expect(result[result.length - 1]).toMatchObject({ date: "2026-09-25", isToday: true });
    expect(result).toHaveLength(olderDates().length + 2);
  });

  it("returns fallback when there is no stored weather and Open-Meteo fails", async () => {
    mockFetch(() => null);

    await expect(getIcaraWeatherData()).resolves.toBe(fallbackDailyWeather);
  });
});

import { isoDateRange, sameWeather, toDailyWeather, toWeatherRows, type OpenMeteoDaily } from "./weatherData";
import openMeteoForecastFixture from "../test/fixtures/open-meteo-forecast.json";
import openMeteoArchiveFixture from "../test/fixtures/open-meteo-archive.json";

describe("toWeatherRows", () => {
  it("converts real Open-Meteo forecast payload to DailyWeatherRow", () => {
    const rows = toWeatherRows(openMeteoForecastFixture.daily as unknown as OpenMeteoDaily, "forecast");
    expect(rows.length).toBeGreaterThanOrEqual(7);

    for (const r of rows) {
      expect(r.source).toBe("forecast");
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof r.weather_code).toBe("number");
      expect(typeof r.temperature_max_c).toBe("number");
      expect(typeof r.temperature_min_c).toBe("number");
      expect(typeof r.sunshine_duration_s).toBe("number");
      expect(typeof r.shortwave_radiation_mj).toBe("number");
      expect(typeof r.precipitation_mm).toBe("number");
    }
  });

  it("converts real Open-Meteo archive payload to DailyWeatherRow", () => {
    const rows = toWeatherRows(openMeteoArchiveFixture.daily as unknown as OpenMeteoDaily, "archive");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].source).toBe("archive");
  });

  it("discards days containing any null field", () => {
    const dailyWithNull: OpenMeteoDaily = {
      time: ["2026-06-01", "2026-06-02"],
      weather_code: [1, 1],
      temperature_2m_max: [25, 25],
      temperature_2m_min: [15, 15],
      sunshine_duration: [30000, 30000],
      shortwave_radiation_sum: [18.5, null], // null radiation (common in older forecast entries)
      precipitation_sum: [0, 0],
    };

    const rows = toWeatherRows(dailyWithNull, "forecast");
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-06-01");
  });
});

describe("isoDateRange", () => {
  it("generates contiguous list of ISO formatted dates", () => {
    expect(isoDateRange("2026-09-01", "2026-09-04")).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });

  it("returns empty array when start date equals end date", () => {
    expect(isoDateRange("2026-09-01", "2026-09-01")).toEqual([]);
  });
});

describe("sameWeather", () => {
  const base: DailyWeatherRow = {
    date: "2026-09-25",
    weather_code: 1,
    temperature_max_c: 25.0,
    temperature_min_c: 15.0,
    sunshine_duration_s: 36000,
    shortwave_radiation_mj: 18.0,
    precipitation_mm: 0.0,
    source: "forecast",
  };

  it("returns true for identical records", () => {
    expect(sameWeather({ ...base }, { ...base })).toBe(true);
  });

  it("returns false when source or metrics change", () => {
    expect(sameWeather(undefined, base)).toBe(false);
    expect(sameWeather({ ...base, source: "archive" }, base)).toBe(false);
    expect(sameWeather({ ...base, shortwave_radiation_mj: 20.0 }, base)).toBe(false);
    expect(sameWeather({ ...base, temperature_max_c: 26.0 }, base)).toBe(false);
  });
});

describe("toDailyWeather", () => {
  const row: DailyWeatherRow = {
    date: "2026-09-25",
    weather_code: 1,
    temperature_max_c: 25.0,
    temperature_min_c: 15.0,
    sunshine_duration_s: 36000, // 10h
    shortwave_radiation_mj: 18.0, // 18 / 3.6 = 5 HSP
    precipitation_mm: 0.0,
    source: "forecast",
  };

  it("calculates theoretical estimate 16 kWp * HSP * 0.81 when no real generation measurement exists", () => {
    // 5 HSP * 16 kWp * 0.81 = 64.8 kWh
    const weather = toDailyWeather(row, "2026-09-29", undefined);

    expect(weather.solarRadiationHsp).toBe(5);
    expect(weather.estimatedKwh).toBe(64.8);
    expect(weather.isReal).toBe(false);
    expect(weather.realKwh).toBeUndefined();
    expect(weather.isToday).toBe(false);
  });

  it("uses actual measured value when reported generation exists", () => {
    const generation = { kwh: 72.5, isReal: true };
    const weather = toDailyWeather(row, "2026-09-25", generation);

    expect(weather.estimatedKwh).toBe(72.5);
    expect(weather.isReal).toBe(true);
    expect(weather.realKwh).toBe(72.5);
    expect(weather.isToday).toBe(true);
  });
});

