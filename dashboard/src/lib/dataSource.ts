import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import * as realQueries from "@/lib/queries";
import * as realWeather from "@/lib/weatherData";
import * as demoQueries from "@/lib/demo/queries";
import type { DailyGenerationEntry } from "@/lib/queries";
import type {
  SolarTelemetryRow,
  UtilityDataRow,
  SunCurvePoint,
  GenerationPoint,
  MultiYearHistory,
} from "@/lib/types";
import type { DailyWeather } from "@/lib/weather";

export interface DataSource {
  isDemo: boolean;
  getLatestTelemetry(): Promise<SolarTelemetryRow | null>;
  getLatestUtilityData(): Promise<UtilityDataRow | null>;
  getTodaySunCurve(): Promise<SunCurvePoint[]>;
  getGenerationByDay(
    daysBack?: number,
  ): Promise<Record<string, DailyGenerationEntry>>;
  getMonthlyGeneration(): Promise<GenerationPoint[]>;
  getMultiYearHistory(): Promise<MultiYearHistory>;
  getYearlyGeneration(): Promise<GenerationPoint[]>;
  getIcaraWeatherData(): Promise<DailyWeather[]>;
}

export async function isDemoMode(): Promise<boolean> {
  const cookieStore = await cookies();
  const hasDemoCookie = cookieStore.get("solarhub_demo")?.value === "1";
  if (!hasDemoCookie) return false;

  // If demo cookie is present and no Supabase auth cookies exist, running in demo mode
  // without needing to instantiate the Supabase client.
  const allCookies = cookieStore.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
  );
  if (!hasAuthCookie) {
    return true;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !user;
  } catch {
    return true;
  }
}

export async function getDataSource(): Promise<DataSource> {
  const demo = await isDemoMode();

  if (demo) {
    return {
      isDemo: true,
      getLatestTelemetry: demoQueries.getDemoLatestTelemetry,
      getLatestUtilityData: demoQueries.getDemoLatestUtilityData,
      getTodaySunCurve: demoQueries.getDemoTodaySunCurve,
      getGenerationByDay: demoQueries.getDemoGenerationByDay,
      getMonthlyGeneration: demoQueries.getDemoMonthlyGeneration,
      getMultiYearHistory: demoQueries.getDemoMultiYearHistory,
      getYearlyGeneration: demoQueries.getDemoYearlyGeneration,
      getIcaraWeatherData: demoQueries.getDemoIcaraWeatherData,
    };
  }

  return {
    isDemo: false,
    getLatestTelemetry: realQueries.getLatestTelemetry,
    getLatestUtilityData: realQueries.getLatestUtilityData,
    getTodaySunCurve: realQueries.getTodaySunCurve,
    getGenerationByDay: realQueries.getGenerationByDay,
    getMonthlyGeneration: realQueries.getMonthlyGeneration,
    getMultiYearHistory: realQueries.getMultiYearHistory,
    getYearlyGeneration: realQueries.getYearlyGeneration,
    getIcaraWeatherData: realWeather.getIcaraWeatherData,
  };
}

