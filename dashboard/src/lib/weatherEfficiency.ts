/**
 * Pure calculations behind the weather vs. efficiency section: period selection, period statistics
 * and the chart styling that depends on the selected range. No React or server dependencies.
 */
import { PLANT_DC_KWP, type DailyWeather } from "@/lib/weather";
import type { Locale } from "@/i18n/types";

export type WeatherRange = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<WeatherRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** Weekday ("Seg", "Mon") and day/month ("29/09", "09/29") of an ISO date, in the display language. */
export function formatWeatherDate(dateStr: string, locale: Locale): { dayOfWeek: string; formattedDate: string } {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const intlLocale = locale === "pt-BR" ? "pt-BR" : "en-US";
    const dayOfWeek = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" })
      .format(date)
      .replace(".", "");
    const formattedDate = new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit", timeZone: "UTC" })
      .format(date);
    // Capitalize first letter of weekday
    const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    return { dayOfWeek: capitalizedDay, formattedDate };
  } catch {
    return { dayOfWeek: "", formattedDate: dateStr };
  }
}

/** Last days of the history for the selected range; the compact (overview) version always shows 7 days. */
export function selectDisplayedDays(weatherData: DailyWeather[], range: WeatherRange, compact: boolean): DailyWeather[] {
  return weatherData.slice(-RANGE_DAYS[compact ? "7d" : range]);
}

export interface WeatherPeriodSummary {
  totalKwh: number;
  totalRainMm: number;
  /** Average daily Peak Sun Hours, formatted with two decimals as shown in the UI. */
  avgHsp: string;
  sunnyDays: number;
  partlyCloudyDays: number;
  rainyDays: number;
}

/** Totals and day counts by sky condition (WMO code) for the displayed period. */
export function summarizeWeatherPeriod(days: DailyWeather[]): WeatherPeriodSummary {
  return {
    totalKwh: days.reduce((acc, d) => acc + d.estimatedKwh, 0),
    totalRainMm: days.reduce((acc, d) => acc + d.precipitationMm, 0),
    avgHsp: (days.reduce((acc, d) => acc + d.solarRadiationHsp, 0) / (days.length || 1)).toFixed(2),
    sunnyDays: days.filter((d) => d.weatherCode <= 1).length,
    partlyCloudyDays: days.filter((d) => d.weatherCode >= 2 && d.weatherCode <= 48).length,
    rainyDays: days.filter((d) => d.weatherCode >= 50).length,
  };
}

/** Generation of one day against the DC capacity × irradiation, capped at 150%; null without irradiation. */
export function dayEfficiencyPercent(day: DailyWeather, dcKwp = PLANT_DC_KWP): number | null {
  if (day.solarRadiationHsp <= 0) return null;
  return Math.min(150, Math.round((day.estimatedKwh / (dcKwp * day.solarRadiationHsp)) * 100));
}

export type PerformanceQuality = "excellent" | "good" | "regular";

/** Qualitative band of a performance ratio: ≥ 80% excellent, ≥ 70% good, otherwise regular. */
export function performanceQuality(prPercent: number): PerformanceQuality {
  if (prPercent >= 80) return "excellent";
  if (prPercent >= 70) return "good";
  return "regular";
}

export interface WeatherChartStyle {
  /** 90-day view draws generation as an area instead of bars. */
  useArea: boolean;
  /** Recharts X-axis tick interval. */
  xAxisInterval: number;
  maxBarSize: number;
  irradiationStrokeWidth: number;
  showIrradiationDots: boolean;
}

/** Chart density adapted to the number of days shown; the compact version uses the 7-day style. */
export function weatherChartStyle(range: WeatherRange, compact: boolean): WeatherChartStyle {
  const effective: WeatherRange = compact ? "7d" : range;
  return {
    useArea: effective === "90d",
    xAxisInterval: effective === "90d" ? 14 : effective === "30d" ? 4 : 0,
    maxBarSize: effective === "30d" ? 14 : 36,
    irradiationStrokeWidth: effective === "90d" ? 1.5 : effective === "30d" ? 2 : 3,
    showIrradiationDots: effective === "7d",
  };
}
