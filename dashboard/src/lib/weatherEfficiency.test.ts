import { describe, expect, it } from "vitest";

import {
  dayEfficiencyPercent,
  formatWeatherDate,
  performanceQuality,
  selectDisplayedDays,
  summarizeWeatherPeriod,
  weatherChartStyle,
} from "./weatherEfficiency";
import type { DailyWeather } from "./weather";

const day = (date: string, overrides: Partial<DailyWeather> = {}): DailyWeather => ({
  date,
  isToday: false,
  weatherCode: 0,
  conditionKey: "clearSky",
  icon: "sun",
  tempMax: 26,
  tempMin: 14,
  sunshineHours: 10,
  solarRadiationHsp: 5,
  precipitationMm: 0,
  estimatedKwh: 80,
  isReal: true,
  ...overrides,
});

const history = Array.from({ length: 100 }, (_, i) => day(`2026-${String(6 + Math.floor(i / 30)).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`));

describe("formatWeatherDate", () => {
  it("formats weekday and day/month in Portuguese", () => {
    expect(formatWeatherDate("2026-09-29", "pt-BR")).toEqual({ dayOfWeek: "Ter", formattedDate: "29/09" });
  });

  it("formats weekday and month/day in English", () => {
    expect(formatWeatherDate("2026-09-29", "en")).toEqual({ dayOfWeek: "Tue", formattedDate: "09/29" });
  });

  it("falls back to the raw string when the date is invalid", () => {
    expect(formatWeatherDate("not-a-date", "en")).toEqual({ dayOfWeek: "", formattedDate: "not-a-date" });
  });
});

describe("selectDisplayedDays", () => {
  it.each([
    ["7d", 7],
    ["30d", 30],
    ["90d", 90],
  ] as const)("keeps the last days of the %s range", (range, expected) => {
    const result = selectDisplayedDays(history, range, false);
    expect(result).toHaveLength(expected);
    expect(result[result.length - 1]).toBe(history[history.length - 1]);
  });

  it("always shows 7 days in the compact version", () => {
    expect(selectDisplayedDays(history, "90d", true)).toHaveLength(7);
  });

  it("returns the whole history when it is shorter than the range", () => {
    expect(selectDisplayedDays(history.slice(0, 3), "30d", false)).toHaveLength(3);
  });
});

describe("summarizeWeatherPeriod", () => {
  it("sums generation and rain, averages irradiation and counts days by sky condition", () => {
    const days = [
      day("2026-09-01", { weatherCode: 0, estimatedKwh: 90, solarRadiationHsp: 6 }),
      day("2026-09-02", { weatherCode: 1, estimatedKwh: 85, solarRadiationHsp: 5.5 }),
      day("2026-09-03", { weatherCode: 3, estimatedKwh: 40, solarRadiationHsp: 3, precipitationMm: 0 }),
      day("2026-09-04", { weatherCode: 48, estimatedKwh: 30, solarRadiationHsp: 2.5 }),
      day("2026-09-05", { weatherCode: 63, estimatedKwh: 12.5, solarRadiationHsp: 1.25, precipitationMm: 18.4 }),
      day("2026-09-06", { weatherCode: 95, estimatedKwh: 10, solarRadiationHsp: 1, precipitationMm: 30.2 }),
    ];

    const summary = summarizeWeatherPeriod(days);
    expect(summary.totalRainMm).toBeCloseTo(48.6);
    expect(summary).toEqual({
      totalKwh: 267.5,
      totalRainMm: summary.totalRainMm,
      avgHsp: "3.21",
      sunnyDays: 2,
      partlyCloudyDays: 2,
      rainyDays: 2,
    });
  });

  it("returns zeros for an empty period", () => {
    expect(summarizeWeatherPeriod([])).toEqual({
      totalKwh: 0,
      totalRainMm: 0,
      avgHsp: "0.00",
      sunnyDays: 0,
      partlyCloudyDays: 0,
      rainyDays: 0,
    });
  });
});

describe("dayEfficiencyPercent", () => {
  it("compares generation with DC capacity times irradiation", () => {
    expect(dayEfficiencyPercent(day("2026-09-01", { estimatedKwh: 80, solarRadiationHsp: 5 }), 20)).toBe(80);
  });

  it("caps the result at 150%", () => {
    expect(dayEfficiencyPercent(day("2026-09-01", { estimatedKwh: 500, solarRadiationHsp: 1 }), 20)).toBe(150);
  });

  it("returns null without irradiation", () => {
    expect(dayEfficiencyPercent(day("2026-09-01", { solarRadiationHsp: 0 }), 20)).toBeNull();
  });
});

describe("performanceQuality", () => {
  it.each([
    [85, "excellent"],
    [80, "excellent"],
    [79.9, "good"],
    [70, "good"],
    [69.9, "regular"],
  ] as const)("classifies %s%% as %s", (pr, expected) => {
    expect(performanceQuality(pr)).toBe(expected);
  });
});

describe("weatherChartStyle", () => {
  it("uses bars with dots and thick lines for 7 days", () => {
    expect(weatherChartStyle("7d", false)).toEqual({
      useArea: false,
      xAxisInterval: 0,
      maxBarSize: 36,
      irradiationStrokeWidth: 3,
      showIrradiationDots: true,
    });
  });

  it("uses thinner bars and sparser ticks for 30 days", () => {
    expect(weatherChartStyle("30d", false)).toEqual({
      useArea: false,
      xAxisInterval: 4,
      maxBarSize: 14,
      irradiationStrokeWidth: 2,
      showIrradiationDots: false,
    });
  });

  it("switches to an area chart for 90 days", () => {
    expect(weatherChartStyle("90d", false)).toEqual({
      useArea: true,
      xAxisInterval: 14,
      maxBarSize: 36,
      irradiationStrokeWidth: 1.5,
      showIrradiationDots: false,
    });
  });

  it("keeps the 7-day style in the compact version whatever the range", () => {
    expect(weatherChartStyle("90d", true)).toEqual(weatherChartStyle("7d", false));
  });
});
