import { afterAll, describe, expect, it, vi } from "vitest";
import {
  getGenerationByDay,
  getLatestTelemetry,
  getLatestUtilityData,
  getMonthlyGeneration,
  getMultiYearHistory,
  getStoredDailyWeather,
  getTodaySunCurve,
  getYearlyGeneration,
  saveDailyWeather,
} from "@/lib/queries";
import {
  getAdvisorCache,
  incrementQuota,
  saveAdvisorCache,
} from "@/lib/aiQuota";
import type { DailyWeatherRow } from "@/lib/types";
import { getAdminClient, getAnonClient, getAuthenticatedTestClient } from "./setup";

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_TEST_EMAIL &&
    process.env.SUPABASE_TEST_PASSWORD,
);

const SENTINEL_DATE = "1999-01-01";

describe.skipIf(!hasEnv)("Supabase Integration — Production & Real RLS", () => {
  afterAll(async () => {
    // Safety cleanup of sentinel date using service_role
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = getAdminClient();
      await Promise.all([
        admin.from("ai_advisor_daily").delete().eq("date", SENTINEL_DATE),
        admin.from("daily_weather").delete().eq("date", SENTINEL_DATE),
      ]);
      const [aiCheck, weatherCheck] = await Promise.all([
        admin.from("ai_advisor_daily").select("date").eq("date", SENTINEL_DATE),
        admin.from("daily_weather").select("date").eq("date", SENTINEL_DATE),
      ]);
      expect(aiCheck.data?.length ?? 0).toBe(0);
      expect(weatherCheck.data?.length ?? 0).toBe(0);
    }
  });

  describe("Authentication and RLS", () => {
    it("successfully authenticates dedicated test user", async () => {
      const client = await getAuthenticatedTestClient();
      const { data, error } = await client.auth.getUser();

      expect(error).toBeNull();
      expect(data.user?.email).toBe(process.env.SUPABASE_TEST_EMAIL);
    });

    it("blocks read and write operations for anonymous clients (RLS fail-closed)", async () => {
      const anon = getAnonClient();

      const [tel, util, gen, hist, monthly, ai, weather] = await Promise.all([
        anon.from("solar_telemetry").select("id").limit(1),
        anon.from("utility_data").select("id").limit(1),
        anon.from("daily_generation").select("date").limit(1),
        anon.from("inverter_daily_history").select("id").limit(1),
        anon.from("inverter_monthly_history").select("id").limit(1),
        anon.from("ai_advisor_daily").select("date").limit(1),
        anon.from("daily_weather").select("date").limit(1),
      ]);

      // RLS only allows SELECT for authenticated users: anon gets an empty result or an error
      expect(tel.data?.length ?? 0).toBe(0);
      expect(util.data?.length ?? 0).toBe(0);
      expect(gen.data?.length ?? 0).toBe(0);
      expect(hist.data?.length ?? 0).toBe(0);
      expect(monthly.data?.length ?? 0).toBe(0);
      expect(ai.data?.length ?? 0).toBe(0);
      expect(weather.data?.length ?? 0).toBe(0);

      const insertAttempt = await anon.from("solar_telemetry").insert({
        plant_name: "Tentativa de escrita não autorizada",
        inverters_count: 1,
        inverters_data: [],
        total_lifetime_kwh: 0,
        total_power_kw: 0,
        total_power_w: 0,
        total_today_kwh: 0,
      });
      expect(insertAttempt.error?.code).toBe("42501");

      const rpcAttempt = await anon.rpc("increment_ai_quota", {
        p_date: SENTINEL_DATE,
        p_is_primary: true,
      });
      expect(rpcAttempt.error).not.toBeNull();
    });

    it("prevents authenticated user from inserting into restricted tables (solar_telemetry and utility_data)", async () => {
      const client = await getAuthenticatedTestClient();

      const [telInsert, utilInsert] = await Promise.all([
        client.from("solar_telemetry").insert({
          plant_name: "Unauthorized write attempt",
          inverters_count: 1,
          inverters_data: [],
          total_lifetime_kwh: 0,
          total_power_kw: 0,
          total_power_w: 0,
          total_today_kwh: 0,
        }),
        client.from("utility_data").insert({
          cpf: "000.000.000-00",
          titular: "Titular Teste",
          distribuidora: "Unauthorized write attempt",
          unidades_consumidoras: {},
        }),
      ]);

      expect(telInsert.error?.code).toBe("42501");
      expect(utilInsert.error?.code).toBe("42501");
    });
  });

  describe("Real Production Queries (queries.ts)", () => {
    it("getLatestTelemetry returns inverter telemetry data and structure", async () => {
      const telemetry = await getLatestTelemetry();
      expect(telemetry).not.toBeNull();
      expect(telemetry?.plant_name).toBeDefined();
      expect(typeof telemetry?.total_power_kw).toBe("number");
      expect(telemetry?.inverters_data.length).toBeGreaterThanOrEqual(1);
    });

    it("getLatestUtilityData returns data with identified generator UC", async () => {
      const utility = await getLatestUtilityData();
      expect(utility).not.toBeNull();
      expect(utility?.distribuidora).toBeDefined();
      expect(utility?.generator_uc).toBeDefined();
      expect(typeof utility?.generator_uc).toBe("string");
    });

    it("getTodaySunCurve returns daily grid points", async () => {
      const curve = await getTodaySunCurve();
      expect(Array.isArray(curve)).toBe(true);
      if (curve.length > 0) {
        expect(curve[0]).toHaveProperty("time");
        expect(curve[0]).toHaveProperty("nominal_cap_kw");
      }
    });

    it("getGenerationByDay returns 30 contiguous days with valid kWh", async () => {
      const byDay = await getGenerationByDay(30);
      const dates = Object.keys(byDay);

      expect(dates.length).toBeGreaterThanOrEqual(25);
      const maxKwhDay = 16.0 * 13; // Physical nominal limit for 16 kWp plant

      for (const d of dates) {
        const entry = byDay[d];
        expect(entry.kwh).toBeGreaterThanOrEqual(0);
        expect(entry.kwh).toBeLessThanOrEqual(maxKwhDay);
        expect(typeof entry.isReal).toBe("boolean");
      }
    });

    it("getMonthlyGeneration and getMultiYearHistory return sorted time series", async () => {
      const [monthly, multi, yearly] = await Promise.all([
        getMonthlyGeneration(),
        getMultiYearHistory("en"),
        getYearlyGeneration("en"),
      ]);

      expect(Array.isArray(monthly)).toBe(true);
      expect(multi.last12Months).toHaveLength(12);
      expect(yearly).toHaveLength(12);
      expect(multi.availableYears.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Production Data Invariants", () => {
    it("has zero negative generation days over the last 30 days", async () => {
      const byDay = await getGenerationByDay(30);
      for (const [date, entry] of Object.entries(byDay)) {
        expect(entry.kwh, `Day ${date} has negative generation`).toBeGreaterThanOrEqual(0);
      }
    });

    it("daily_generation view does not have duplicate dates", async () => {
      const client = await getAuthenticatedTestClient();
      const { data } = await client
        .from("daily_generation")
        .select("date")
        .order("date", { ascending: false })
        .limit(100);

      const dates = (data || []).map((r) => r.date);
      const unique = new Set(dates);
      expect(dates.length).toBe(unique.size);
    });

    it("inverter_daily_history does not have duplicate (date, inverter_id) pairs", async () => {
      const client = await getAuthenticatedTestClient();
      const { data } = await client
        .from("inverter_daily_history")
        .select("date, inverter_id")
        .order("date", { ascending: false })
        .limit(200);

      const pairs = (data || []).map((r) => `${r.date}__${r.inverter_id}`);
      const unique = new Set(pairs);
      expect(pairs.length).toBe(unique.size);
    });
  });

  describe("Controlled Write with Sentinel Date (1999-01-01)", () => {
    it("saveDailyWeather performs upsert and getStoredDailyWeather rereads accurately", async () => {
      const row: DailyWeatherRow = {
        date: SENTINEL_DATE,
        weather_code: 1,
        temperature_max_c: 25.5,
        temperature_min_c: 14.2,
        sunshine_duration_s: 36000,
        shortwave_radiation_mj: 19.5,
        tilted_radiation_kwh: 5.1,
        precipitation_mm: 0.0,
        source: "forecast",
      };

      await saveDailyWeather([row]);
      const stored = await getStoredDailyWeather(SENTINEL_DATE);
      const found = stored.find((r) => r.date === SENTINEL_DATE);

      expect(found).toBeDefined();
      expect(found?.temperature_max_c).toBe(25.5);
      expect(found?.shortwave_radiation_mj).toBe(19.5);
    });

    it("incrementQuota atomically increments quota via RPC", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(`${SENTINEL_DATE}T15:00:00Z`));

      try {
        const [q1, q2] = await Promise.all([
          incrementQuota("gemini-3.8-flash"),
          incrementQuota("gemini-3.8-flash"),
        ]);

        const maxTotal = Math.max(q1.total_calls, q2.total_calls);
        expect(maxTotal).toBeGreaterThanOrEqual(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("saveAdvisorCache persists analysis and getAdvisorCache retrieves from cache", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(`${SENTINEL_DATE}T15:00:00Z`));

      try {
        const analysis = {
          daily: { summary: "Integration test analysis", recommendations: [] },
          monthly: { summary: "Integration test monthly analysis", recommendations: [] },
        };
        await saveAdvisorCache(analysis, "gemini-3.8-flash", "pt-BR");
        const cached = await getAdvisorCache("pt-BR");

        expect(cached).not.toBeNull();
        expect(cached?.modelUsed).toBe("gemini-3.8-flash");
        expect(cached?.data.daily.summary).toBe(analysis.daily.summary);
        await expect(getAdvisorCache("en")).resolves.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
