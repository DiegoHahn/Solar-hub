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

/**
 * DC capacity of the PV modules (kWp). Higher than the 16 kW of the inverters: the arrays are oversized,
 * as is usual, so performance figures must use the module capacity.
 */
export const PLANT_DC_KWP = Number(process.env.NEXT_PUBLIC_PLANT_DC_KWP) || 19.36;

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
 * Performance ratio over the days with measured generation: kWh / (DC kWp × plane-of-array irradiation).
 * Estimated days are excluded because their kWh is derived from irradiance, and so is today,
 * whose generation is still partial.
 */
export function calculatePerformanceRatio(
  days: DailyWeather[],
  dcKwp = PLANT_DC_KWP,
): { prPercent: number; measuredDays: number } | null {
  const measured = days.filter((d) => d.isReal && !d.isToday && d.solarRadiationHsp > 0);
  if (measured.length === 0) return null;
  const producedKwh = measured.reduce((sum, d) => sum + d.estimatedKwh, 0);
  const referenceKwh = measured.reduce((sum, d) => sum + d.solarRadiationHsp * dcKwp, 0);
  return { prPercent: (producedKwh / referenceKwh) * 100, measuredDays: measured.length };
}

/**
 * Energy not generated because of clouds: for each day, the irradiation gap to the sunniest day of the
 * same month, converted to kWh with the plant's measured performance ratio (or `fallbackPr`).
 * The reference is taken per month from `referenceDays` (usually the full 90-day history) so that
 * a short window of cloudy days is not compared only with itself, and winter is not compared with spring.
 */
export function calculateCloudLoss(
  days: DailyWeather[],
  referenceDays: DailyWeather[] = days,
  dcKwp = PLANT_DC_KWP,
  fallbackPr = 0.81,
): { lostKwh: number; evaluatedDays: number } | null {
  const evaluated = days.filter((d) => !d.isToday);
  if (evaluated.length === 0) return null;

  const clearSkyByMonth = new Map<string, number>();
  for (const d of [...referenceDays, ...evaluated]) {
    const month = d.date.slice(0, 7);
    clearSkyByMonth.set(month, Math.max(clearSkyByMonth.get(month) ?? 0, d.solarRadiationHsp));
  }

  const pr = (calculatePerformanceRatio(referenceDays, dcKwp)?.prPercent ?? fallbackPr * 100) / 100;
  const lostKwh = evaluated.reduce((sum, d) => {
    const gap = (clearSkyByMonth.get(d.date.slice(0, 7)) ?? 0) - d.solarRadiationHsp;
    return sum + Math.max(0, gap) * dcKwp * pr;
  }, 0);
  return { lostKwh, evaluatedDays: evaluated.length };
}
