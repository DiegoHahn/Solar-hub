import {
  getGenerationByDay,
  getStoredDailyWeather,
  saveDailyWeather,
  type DailyGenerationEntry,
} from "@/lib/queries";
import { brasiliaIsoDaysAgo, toBrasiliaIsoDate } from "@/lib/dates";
import { fallbackDailyWeather, parseWmoCode, type DailyWeather } from "@/lib/weather";
import type { DailyWeatherRow } from "@/lib/types";

const HISTORY_DAYS = 90;
/** Sliding refresh window: period in which Open-Meteo replaces forecasts with observed data. */
const REFRESH_DAYS = 7;
const NOMINAL_KWP = 16.0;
/** Performance ratio used to estimate PV generation from Peak Sun Hours (HSP). */
const PERFORMANCE_RATIO = 0.81;

const DAILY_FIELDS =
  "weather_code,temperature_2m_max,temperature_2m_min,sunshine_duration,shortwave_radiation_sum,precipitation_sum";

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface OpenMeteoDaily {
  time: string[];
  weather_code: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  sunshine_duration: (number | null)[];
  shortwave_radiation_sum: (number | null)[];
  precipitation_sum: (number | null)[];
}

interface PlantLocation {
  lat: string;
  lon: string;
  tilt: string;
  azimuth: string;
}

function getPlantLocation(): PlantLocation {
  return {
    lat: process.env.NEXT_PUBLIC_SOLAR_LATITUDE || process.env.SOLAR_LATITUDE || "-28.7139",
    lon: process.env.NEXT_PUBLIC_SOLAR_LONGITUDE || process.env.SOLAR_LONGITUDE || "-49.3003",
    tilt: process.env.NEXT_PUBLIC_SOLAR_TILT || process.env.SOLAR_TILT || "15",
    azimuth: process.env.NEXT_PUBLIC_SOLAR_AZIMUTH || process.env.SOLAR_AZIMUTH || "155",
  };
}

function locationQuery({ lat, lon, tilt, azimuth }: PlantLocation): string {
  return `latitude=${lat}&longitude=${lon}&daily=${DAILY_FIELDS}&tilt=${tilt}&azimuth=${azimuth}&timezone=America%2FSao_Paulo`;
}

async function fetchDaily(url: string): Promise<OpenMeteoDaily | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { daily?: OpenMeteoDaily };
    return json.daily?.time?.length ? json.daily : null;
  } catch {
    return null;
  }
}

/** Converts Open-Meteo daily response into rows; days with any null field are dropped. */
export function toWeatherRows(daily: OpenMeteoDaily, source: DailyWeatherRow["source"]): DailyWeatherRow[] {
  const rows: DailyWeatherRow[] = [];
  daily.time.forEach((date, i) => {
    const code = daily.weather_code[i];
    const tempMax = daily.temperature_2m_max[i];
    const tempMin = daily.temperature_2m_min[i];
    const sunshine = daily.sunshine_duration[i];
    const radiation = daily.shortwave_radiation_sum[i];
    const precipitation = daily.precipitation_sum[i];
    if (code == null || tempMax == null || tempMin == null || sunshine == null || radiation == null || precipitation == null) {
      return;
    }
    rows.push({
      date,
      weather_code: code,
      temperature_max_c: tempMax,
      temperature_min_c: tempMin,
      sunshine_duration_s: sunshine,
      shortwave_radiation_mj: radiation,
      precipitation_mm: precipitation,
      source,
    });
  });
  return rows;
}

/** ISO dates from `startIso` (inclusive) to `endIso` (exclusive). */
export function isoDateRange(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (cursor < end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Fetches necessary weather updates from Open-Meteo. If history is already stored, only the recent
 * sliding window is refreshed; otherwise, fetches the full 90-day forecast, supplementing older dates
 * missing solar radiation with the Open-Meteo Archive API.
 */
async function fetchWeatherUpdates(
  location: PlantLocation,
  startIso: string,
  refreshFromIso: string,
  stored: Map<string, DailyWeatherRow>,
): Promise<DailyWeatherRow[]> {
  const olderDates = isoDateRange(startIso, refreshFromIso);
  const query = locationQuery(location);

  if (olderDates.every((d) => stored.has(d))) {
    const recent = await fetchDaily(
      `https://api.open-meteo.com/v1/forecast?${query}&past_days=${REFRESH_DAYS}&forecast_days=1`,
    );
    return recent ? toWeatherRows(recent, "forecast") : [];
  }

  const forecast = await fetchDaily(
    `https://api.open-meteo.com/v1/forecast?${query}&past_days=${HISTORY_DAYS}&forecast_days=1`,
  );
  const rows = forecast ? toWeatherRows(forecast, "forecast") : [];

  const fetchedDates = new Set(rows.map((r) => r.date));
  const missing = olderDates.filter((d) => !fetchedDates.has(d) && !stored.has(d));
  if (missing.length > 0) {
    const archive = await fetchDaily(
      `https://archive-api.open-meteo.com/v1/archive?${query}&start_date=${missing[0]}&end_date=${missing[missing.length - 1]}`,
    );
    if (archive) {
      rows.push(...toWeatherRows(archive, "archive").filter((r) => !fetchedDates.has(r.date)));
    }
  }

  return rows;
}

export function sameWeather(a: DailyWeatherRow | undefined, b: DailyWeatherRow): boolean {
  return (
    a !== undefined &&
    a.source === b.source &&
    Number(a.weather_code) === b.weather_code &&
    Number(a.temperature_max_c) === b.temperature_max_c &&
    Number(a.temperature_min_c) === b.temperature_min_c &&
    Number(a.sunshine_duration_s) === b.sunshine_duration_s &&
    Number(a.shortwave_radiation_mj) === b.shortwave_radiation_mj &&
    Number(a.precipitation_mm) === b.precipitation_mm
  );
}

export function toDailyWeather(
  row: DailyWeatherRow,
  todayIso: string,
  generation: DailyGenerationEntry | undefined,
): DailyWeather {
  const [year, month, day] = row.date.split("-");
  const code = Number(row.weather_code);
  const { condition, conditionKey, icon } = parseWmoCode(code);
  // 1 MJ/m² = 1/3.6 kWh/m² (Peak Sun Hours / HSP)
  const hsp = Number((Number(row.shortwave_radiation_mj) / 3.6).toFixed(2));
  const kwh = Number((generation ? generation.kwh : NOMINAL_KWP * hsp * PERFORMANCE_RATIO).toFixed(1));
  const isReal = Boolean(generation?.isReal);

  return {
    date: row.date,
    dayOfWeek: dayNames[new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()],
    formattedDate: row.date === todayIso ? "Hoje" : `${day}/${month}`,
    weatherCode: code,
    condition,
    conditionKey,
    icon,
    tempMax: Number(row.temperature_max_c),
    tempMin: Number(row.temperature_min_c),
    sunshineHours: Number((Number(row.sunshine_duration_s) / 3600).toFixed(1)),
    solarRadiationHsp: hsp,
    precipitationMm: Number(row.precipitation_mm),
    estimatedKwh: kwh,
    isReal,
    realKwh: isReal ? kwh : undefined,
  };
}

/**
 * Weather for the past 90 days (Open-Meteo) combined with plant solar generation data.
 * Weather is cached in `daily_weather`: on each call only the recent window is re-polled and only
 * changed days are re-saved. Days without recorded telemetry receive an irradiance-based estimate.
 */
export async function getIcaraWeatherData(): Promise<DailyWeather[]> {
  try {
    const now = new Date();
    const todayIso = toBrasiliaIsoDate(now);
    const startIso = brasiliaIsoDaysAgo(HISTORY_DAYS, now);
    const refreshFromIso = brasiliaIsoDaysAgo(REFRESH_DAYS, now);

    const [storedRows, generationByDay] = await Promise.all([
      getStoredDailyWeather(startIso),
      getGenerationByDay(HISTORY_DAYS),
    ]);

    const byDate = new Map(storedRows.map((r) => [r.date, r]));
    const updates = await fetchWeatherUpdates(getPlantLocation(), startIso, refreshFromIso, byDate);
    await saveDailyWeather(updates.filter((r) => !sameWeather(byDate.get(r.date), r)));
    for (const row of updates) byDate.set(row.date, row);

    const rows = [...byDate.values()]
      .filter((r) => r.date >= startIso && r.date <= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length === 0) return fallbackDailyWeather;
    return rows.map((row) => toDailyWeather(row, todayIso, generationByDay[row.date]));
  } catch (err) {
    console.error("Error building weather dataset:", err);
    return fallbackDailyWeather;
  }
}
