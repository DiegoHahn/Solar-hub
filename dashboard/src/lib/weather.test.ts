import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyWeatherRow } from "./types";

vi.mock("./queries", () => ({
  getGenerationByDay: vi.fn(),
  getStoredDailyWeather: vi.fn(),
  saveDailyWeather: vi.fn(),
}));

import { getGenerationByDay, getStoredDailyWeather, saveDailyWeather } from "./queries";
import {
  fallbackDailyWeather,
  parseWmoCode,
  calculatePerformanceRatio,
  calculateCloudLoss,
  type DailyWeather,
} from "./weather";
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
  isToday: false,
  ...overrides,
});

describe("calculatePerformanceRatio", () => {
  it("divides measured kWh by DC capacity times irradiation", () => {
    const result = calculatePerformanceRatio(
      [
        day({ estimatedKwh: 80, solarRadiationHsp: 5 }), // 80 / (5 * 20) = 0.80
        day({ estimatedKwh: 85, solarRadiationHsp: 5 }), // 85 / (5 * 20) = 0.85
      ],
      20,
    );

    expect(result).toEqual({ prPercent: 82.5, measuredDays: 2 });
  });

  it("ignores estimated days, today, and zero-irradiance days", () => {
    const result = calculatePerformanceRatio(
      [
        day({ estimatedKwh: 80, solarRadiationHsp: 5 }),
        day({ estimatedKwh: 70, solarRadiationHsp: 5, isReal: false }),
        day({ estimatedKwh: 10, solarRadiationHsp: 5, isToday: true }),
        day({ estimatedKwh: 0, solarRadiationHsp: 0 }),
      ],
      20,
    );

    expect(result).toEqual({ prPercent: 80, measuredDays: 1 });
  });

  it("returns null when the period has no measured days", () => {
    expect(calculatePerformanceRatio([day({ isReal: false })])).toBeNull();
    expect(calculatePerformanceRatio([])).toBeNull();
  });
});

describe("calculateCloudLoss", () => {
  // Measured PR of these days with 20 kWp: 96 / (6 * 20) = 64 / (4 * 20) = 0.8
  const sunny = day({ date: "2026-09-01", solarRadiationHsp: 6, estimatedKwh: 96 });
  const cloudy = day({ date: "2026-09-02", solarRadiationHsp: 4, estimatedKwh: 64 });

  it("converts the gap to the sunniest day of the month with the measured PR", () => {
    // (6 - 4) * 20 kWp * 0.8 = 32 kWh
    expect(calculateCloudLoss([sunny, cloudy], [sunny, cloudy], 20)).toEqual({ lostKwh: 32, evaluatedDays: 2 });
  });

  it("takes the clear-sky reference from the reference history, not only the displayed window", () => {
    const window = [day({ date: "2026-09-10", solarRadiationHsp: 3, estimatedKwh: 48 })];

    // Reference 6 HSP from Sep 1 and PR 0.8: (6 - 3) * 20 * 0.8 = 48 kWh
    expect(calculateCloudLoss(window, [sunny, ...window], 20)?.lostKwh).toBeCloseTo(48, 6);
  });

  it("compares each day only with days of its own month", () => {
    const winter = day({ date: "2026-06-10", solarRadiationHsp: 3.5, estimatedKwh: 56 });

    expect(calculateCloudLoss([winter], [winter, sunny], 20)?.lostKwh).toBe(0);
  });

  it("falls back to the default PR when no day was measured", () => {
    const estimated = [
      day({ date: "2026-09-01", solarRadiationHsp: 6, isReal: false }),
      day({ date: "2026-09-02", solarRadiationHsp: 4, isReal: false }),
    ];

    // (6 - 4) * 20 * 0.81 = 32.4 kWh
    expect(calculateCloudLoss(estimated, estimated, 20)?.lostKwh).toBeCloseTo(32.4, 6);
  });

  it("ignores today and returns null when no past days exist", () => {
    const today = day({ date: "2026-09-03", solarRadiationHsp: 1, isToday: true });

    expect(calculateCloudLoss([sunny, cloudy, today], [sunny, cloudy, today], 20)?.evaluatedDays).toBe(2);
    expect(calculateCloudLoss([])).toBeNull();
    expect(calculateCloudLoss([today])).toBeNull();
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
    tilted_radiation_kwh: 5.5,
    precipitation_mm: 0,
    source: "archive",
    ...overrides,
  });

  /** Optional `tilted` adds 24 hourly plane-of-array values per day summing to that many kWh/m². */
  const daily = (days: Array<[string, number | null, number]>, tilted?: number) => ({
    ...(tilted !== undefined && {
      hourly: {
        time: days.flatMap(([d]) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, "0")}:00`)),
        global_tilted_irradiance: days.flatMap(() => Array.from({ length: 24 }, () => (tilted * 1000) / 24)),
      },
    }),
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

    // Without plane-of-array data and recorded generation: 19.36 kWp * 2 HSP (7.2 MJ) * 0.81
    expect(jun27).toMatchObject({ conditionKey: "continuousRain", solarRadiationHsp: 2, estimatedKwh: 31.4, isReal: false });
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
      row("2026-09-24", {
        source: "forecast",
        weather_code: 0,
        temperature_max_c: 28.1,
        temperature_min_c: 15.2,
        sunshine_duration_s: 36000,
        tilted_radiation_kwh: null,
      }),
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

  it("refetches stored days without plane-of-array irradiation and uses it as HSP", async () => {
    vi.mocked(getStoredDailyWeather).mockResolvedValue(olderDates().map((d) => row(d, { tilted_radiation_kwh: null })));
    mockFetch((url) =>
      url.includes("archive-api") ? daily([["2026-06-27", 18, 0]], 5.8) : daily([["2026-09-25", 18, 0]], 4.2),
    );

    const result = await getIcaraWeatherData();

    const calls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(calls.some((u) => u.includes("archive-api") && u.includes("start_date=2026-06-27"))).toBe(true);
    expect(calls.every((u) => u.includes("hourly=global_tilted_irradiance"))).toBe(true);

    const saved = vi.mocked(saveDailyWeather).mock.calls[0][0];
    expect(saved.find((r) => r.date === "2026-06-27")?.tilted_radiation_kwh).toBe(5.8);
    expect(result.find((d) => d.date === "2026-06-27")?.solarRadiationHsp).toBe(5.8);
    expect(result.find((d) => d.date === "2026-09-25")?.solarRadiationHsp).toBe(4.2);
  });

  it("returns fallback when there is no stored weather and Open-Meteo fails", async () => {
    mockFetch(() => null);

    await expect(getIcaraWeatherData()).resolves.toBe(fallbackDailyWeather);
  });
});

import {
  isoDateRange,
  sameWeather,
  tiltedKwhByDate,
  toDailyWeather,
  toWeatherRows,
  type OpenMeteoDaily,
} from "./weatherData";
import openMeteoForecastFixture from "../test/fixtures/open-meteo-forecast.json";
import openMeteoArchiveFixture from "../test/fixtures/open-meteo-archive.json";

describe("toWeatherRows", () => {
  it("converts real Open-Meteo forecast payload to DailyWeatherRow", () => {
    const rows = toWeatherRows({ daily: openMeteoForecastFixture.daily as unknown as OpenMeteoDaily }, "forecast");
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
    const rows = toWeatherRows({ daily: openMeteoArchiveFixture.daily as unknown as OpenMeteoDaily }, "archive");
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

    const rows = toWeatherRows({ daily: dailyWithNull }, "forecast");
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-06-01");
  });
});

describe("tiltedKwhByDate", () => {
  const hours = (date: string) => Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, "0")}:00`);

  it("sums hourly W/m² into daily kWh/m²", () => {
    const result = tiltedKwhByDate({
      time: hours("2026-10-02"),
      global_tilted_irradiance: Array.from({ length: 24 }, (_, h) => (h >= 6 && h < 18 ? 500 : 0)),
    });

    expect(result.get("2026-10-02")).toBe(6);
  });

  it("leaves out days with missing hours", () => {
    const values = Array.from({ length: 24 }, () => 100 as number | null);
    values[12] = null;

    expect(tiltedKwhByDate({ time: hours("2026-10-02"), global_tilted_irradiance: values }).size).toBe(0);
    expect(tiltedKwhByDate(undefined).size).toBe(0);
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
    tilted_radiation_kwh: 5.2,
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
    expect(sameWeather({ ...base, tilted_radiation_kwh: null }, base)).toBe(false);
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
    tilted_radiation_kwh: null,
    precipitation_mm: 0.0,
    source: "forecast",
  };

  it("estimates DC kWp * HSP * 0.81 when no real generation measurement exists", () => {
    // 5 HSP * 19.36 kWp * 0.81 = 78.4 kWh
    const weather = toDailyWeather(row, "2026-09-29", undefined);

    expect(weather.solarRadiationHsp).toBe(5);
    expect(weather.estimatedKwh).toBe(78.4);
    expect(weather.isReal).toBe(false);
    expect(weather.realKwh).toBeUndefined();
    expect(weather.isToday).toBe(false);
  });

  it("prefers plane-of-array irradiation over horizontal irradiation", () => {
    expect(toDailyWeather({ ...row, tilted_radiation_kwh: 5.42 }, "2026-09-29", undefined).solarRadiationHsp).toBe(5.42);
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

