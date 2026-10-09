import { createClient } from "@/lib/supabase/server";
import type { DailyWeatherRow } from "@/lib/types";

/** Daily weather stored from `startIso` (inclusive), in chronological order. */
export async function getStoredDailyWeather(startIso: string): Promise<DailyWeatherRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_weather")
    .select(
      "date, weather_code, temperature_max_c, temperature_min_c, sunshine_duration_s, shortwave_radiation_mj, tilted_radiation_kwh, precipitation_mm, source",
    )
    .gte("date", startIso)
    .order("date", { ascending: true });

  if (error) {
    console.error("Error reading daily_weather:", error);
    return [];
  }
  return (data ?? []) as DailyWeatherRow[];
}

/** Upserts weather days received from Open-Meteo by date. */
export async function saveDailyWeather(rows: DailyWeatherRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("daily_weather")
    .upsert(
      rows.map((r) => ({ ...r, updated_at: now })),
      { onConflict: "date" },
    );
  if (error) console.error("Error saving daily_weather:", error);
}
