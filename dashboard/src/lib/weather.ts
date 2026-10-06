/**
 * Weather types and utilities (Open-Meteo) without server dependencies, also used in client components.
 * Data fetching logic resides in lib/weatherData.ts.
 */

/** Dictionary key under `t.weather`; labels are resolved in the UI for the active locale. */
export type WeatherConditionKey =
  | "clearSky"
  | "sunny"
  | "partlyCloudy"
  | "overcast"
  | "foggy"
  | "drizzle"
  | "continuousRain"
  | "rainShowers"
  | "thunderstorm"
  | "cloudVariation";

export type WeatherIcon = "sun" | "cloud-sun" | "cloud" | "rain" | "storm";

export interface DailyWeather {
  date: string; // YYYY-MM-DD
  isToday: boolean;
  weatherCode: number;
  conditionKey: WeatherConditionKey;
  icon: WeatherIcon;
  tempMax: number;
  tempMin: number;
  sunshineHours: number;
  solarRadiationHsp: number; // Peak Sun Hours (HSP / kWh/m²) converted from MJ/m²
  precipitationMm: number;
  estimatedKwh: number; // Real or estimated solar generation for 16 kWp plant
  isReal?: boolean; // true if from inverter telemetry (rather than solar irradiation estimation)
  realKwh?: number;
}

/** Maps Open-Meteo WMO weather codes to a condition key and icon. */
export function parseWmoCode(code: number): { conditionKey: WeatherConditionKey; icon: WeatherIcon } {
  if (code === 0) return { conditionKey: "clearSky", icon: "sun" };
  if (code === 1) return { conditionKey: "sunny", icon: "sun" };
  if (code === 2) return { conditionKey: "partlyCloudy", icon: "cloud-sun" };
  if (code === 3) return { conditionKey: "overcast", icon: "cloud" };
  if (code >= 45 && code <= 48) return { conditionKey: "foggy", icon: "cloud" };
  if (code >= 51 && code <= 55) return { conditionKey: "drizzle", icon: "rain" };
  if (code >= 61 && code <= 65) return { conditionKey: "continuousRain", icon: "rain" };
  if (code >= 80 && code <= 82) return { conditionKey: "rainShowers", icon: "rain" };
  if (code >= 95 && code <= 99) return { conditionKey: "thunderstorm", icon: "storm" };
  return { conditionKey: "cloudVariation", icon: "cloud-sun" };
}

/**
 * Specific yield (kWh per installed kWp per day) over the days with measured generation.
 * Estimated days are excluded because their kWh is derived from irradiance, and so is today,
 * whose generation is still partial.
 */
export function specificYield(
  days: DailyWeather[],
  nominalKwp = 16,
): { kwhPerKwpDay: number; measuredDays: number } | null {
  const measured = days.filter((d) => d.isReal && !d.isToday);
  if (measured.length === 0) return null;
  const producedKwh = measured.reduce((sum, d) => sum + d.estimatedKwh, 0);
  return { kwhPerKwpDay: producedKwh / nominalKwp / measured.length, measuredDays: measured.length };
}

/** Fixed series observed in Içara/SC, used when Open-Meteo API is unreachable */
export const fallbackDailyWeather: DailyWeather[] = [
  {
    date: "2026-08-28",
    isToday: false,
    weatherCode: 80,
    ...parseWmoCode(80),
    tempMax: 27.2,
    tempMin: 17.0,
    sunshineHours: 2.1,
    solarRadiationHsp: 1.73, // 6.24 MJ / 3.6,
    precipitationMm: 4.2,
    estimatedKwh: 22.8,
  },
  {
    date: "2026-08-29",
    isToday: false,
    weatherCode: 95,
    ...parseWmoCode(95),
    tempMax: 19.4,
    tempMin: 16.2,
    sunshineHours: 1.7,
    solarRadiationHsp: 1.96,
    precipitationMm: 35.5,
    estimatedKwh: 25.1,
  },
  {
    date: "2026-08-30",
    isToday: false,
    weatherCode: 81,
    ...parseWmoCode(81),
    tempMax: 19.9,
    tempMin: 15.7,
    sunshineHours: 3.1,
    solarRadiationHsp: 2.37,
    precipitationMm: 24.2,
    estimatedKwh: 31.4,
  },
  {
    date: "2026-08-31",
    isToday: false,
    weatherCode: 82,
    ...parseWmoCode(82),
    tempMax: 18.6,
    tempMin: 16.0,
    sunshineHours: 0.0,
    solarRadiationHsp: 0.87,
    precipitationMm: 62.7,
    estimatedKwh: 12.3,
  },
  {
    date: "2026-09-01",
    isToday: false,
    weatherCode: 51,
    ...parseWmoCode(51),
    tempMax: 22.1,
    tempMin: 15.9,
    sunshineHours: 10.1,
    solarRadiationHsp: 4.53,
    precipitationMm: 1.2,
    estimatedKwh: 58.4,
  },
  {
    date: "2026-09-02",
    isToday: false,
    weatherCode: 3,
    ...parseWmoCode(3),
    tempMax: 20.3,
    tempMin: 12.0,
    sunshineHours: 11.0,
    solarRadiationHsp: 5.37,
    precipitationMm: 0.0,
    estimatedKwh: 68.2,
  },
  {
    date: "2026-09-03",
    isToday: false,
    weatherCode: 0,
    ...parseWmoCode(0),
    tempMax: 27.1,
    tempMin: 11.3,
    sunshineHours: 11.1,
    solarRadiationHsp: 5.33,
    precipitationMm: 0.0,
    estimatedKwh: 67.5,
  },
  {
    date: "2026-09-04",
    isToday: true,
    weatherCode: 2,
    ...parseWmoCode(2),
    tempMax: 23.4,
    tempMin: 11.9,
    sunshineHours: 8.5,
    solarRadiationHsp: 4.25,
    precipitationMm: 0.0,
    estimatedKwh: 58.4,
  },
];
