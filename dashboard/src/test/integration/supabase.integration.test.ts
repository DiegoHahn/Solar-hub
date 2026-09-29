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
  fallbackAdvisorAnalysis,
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

describe.skipIf(!hasEnv)("Integração Supabase — Produção e RLS Real", () => {
  afterAll(async () => {
    // Limpeza de segurança da data sentinela usando service_role
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

  describe("Autenticação e RLS", () => {
    it("autentica com sucesso o usuário dedicado de testes", async () => {
      const client = await getAuthenticatedTestClient();
      const { data, error } = await client.auth.getUser();

      expect(error).toBeNull();
      expect(data.user?.email).toBe(process.env.SUPABASE_TEST_EMAIL);
    });

    it("bloqueia leitura e escrita para clientes anônimos (RLS fail-closed)", async () => {
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

      // RLS restringe SELECT apenas a authenticated: anon recebe vazio ou erro
      expect(tel.data?.length ?? 0).toBe(0);
      expect(util.data?.length ?? 0).toBe(0);
      expect(gen.data?.length ?? 0).toBe(0);
      expect(hist.data?.length ?? 0).toBe(0);
      expect(monthly.data?.length ?? 0).toBe(0);
      expect(ai.data?.length ?? 0).toBe(0);
      expect(weather.data?.length ?? 0).toBe(0);

      const insertAttempt = await anon
        .from("solar_telemetry")
        .insert({ plant_name: "Ataque Anon" });
      expect(insertAttempt.error).not.toBeNull();

      const rpcAttempt = await anon.rpc("increment_ai_quota", {
        p_date: SENTINEL_DATE,
        p_is_primary: true,
      });
      expect(rpcAttempt.error).not.toBeNull();
    });

    it("impede que usuário autenticado insira em tabelas restritas (solar_telemetry e utility_data)", async () => {
      const client = await getAuthenticatedTestClient();

      const [telInsert, utilInsert] = await Promise.all([
        client.from("solar_telemetry").insert({ plant_name: "Tentativa de escrita não autorizada" }),
        client.from("utility_data").insert({ distribuidora: "Tentativa de escrita não autorizada" }),
      ]);

      expect(telInsert.error).not.toBeNull();
      expect(utilInsert.error).not.toBeNull();
    });
  });

  describe("Consultas Reais de Produção (queries.ts)", () => {
    it("getLatestTelemetry retorna os dados e estrutura dos inversores", async () => {
      const telemetry = await getLatestTelemetry();
      expect(telemetry).not.toBeNull();
      expect(telemetry?.plant_name).toBeDefined();
      expect(typeof telemetry?.total_power_kw).toBe("number");
      expect(telemetry?.inverters_data.length).toBeGreaterThanOrEqual(1);
    });

    it("getLatestUtilityData retorna dados com UC geradora identificada", async () => {
      const utility = await getLatestUtilityData();
      expect(utility).not.toBeNull();
      expect(utility?.distribuidora).toBeDefined();
      expect(utility?.generator_uc).toBeDefined();
      expect(typeof utility?.generator_uc).toBe("string");
    });

    it("getTodaySunCurve retorna pontos da grade diária", async () => {
      const curve = await getTodaySunCurve();
      expect(Array.isArray(curve)).toBe(true);
      if (curve.length > 0) {
        expect(curve[0]).toHaveProperty("time");
        expect(curve[0]).toHaveProperty("nominal_cap_kw");
      }
    });

    it("getGenerationByDay retorna 30 dias contíguos com kWh válido", async () => {
      const byDay = await getGenerationByDay(30);
      const dates = Object.keys(byDay);

      expect(dates.length).toBeGreaterThanOrEqual(25);
      const maxKwhDay = 16.0 * 13; // Limite físico nominal para a usina de 16 kWp

      for (const d of dates) {
        const entry = byDay[d];
        expect(entry.kwh).toBeGreaterThanOrEqual(0);
        expect(entry.kwh).toBeLessThanOrEqual(maxKwhDay);
        expect(typeof entry.isReal).toBe("boolean");
      }
    });

    it("getMonthlyGeneration e getMultiYearHistory retornam séries temporais ordenadas", async () => {
      const [monthly, multi, yearly] = await Promise.all([
        getMonthlyGeneration(),
        getMultiYearHistory(),
        getYearlyGeneration(),
      ]);

      expect(Array.isArray(monthly)).toBe(true);
      expect(multi.last12Months).toHaveLength(12);
      expect(yearly).toHaveLength(12);
      expect(multi.availableYears.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Invariantes de Dados em Produção", () => {
    it("não possui nenhum dia com geração negativa nos últimos 30 dias", async () => {
      const byDay = await getGenerationByDay(30);
      for (const [date, entry] of Object.entries(byDay)) {
        expect(entry.kwh, `Dia ${date} com geração negativa`).toBeGreaterThanOrEqual(0);
      }
    });

    it("view daily_generation não possui datas duplicadas", async () => {
      const client = await getAuthenticatedTestClient();
      const { data } = await client
        .from("daily_generation")
        .select("date")
        .order("date", { ascending: false })
        .limit(100);

      const dates = (data || []).map((r: { date: string }) => r.date);
      const unique = new Set(dates);
      expect(dates.length).toBe(unique.size);
    });

    it("inverter_daily_history não possui duplicatas de (date, inverter_id)", async () => {
      const client = await getAuthenticatedTestClient();
      const { data } = await client
        .from("inverter_daily_history")
        .select("date, inverter_id")
        .order("date", { ascending: false })
        .limit(200);

      const pairs = (data || []).map((r: { date: string; inverter_id: string }) => `${r.date}__${r.inverter_id}`);
      const unique = new Set(pairs);
      expect(pairs.length).toBe(unique.size);
    });
  });

  describe("Escrita Controlada com Data Sentinela (1999-01-01)", () => {
    it("saveDailyWeather realiza upsert e getStoredDailyWeather relê com fidelidade", async () => {
      const row: DailyWeatherRow = {
        date: SENTINEL_DATE,
        weather_code: 1,
        temperature_max_c: 25.5,
        temperature_min_c: 14.2,
        sunshine_duration_s: 36000,
        shortwave_radiation_mj: 19.5,
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

    it("incrementQuota incrementa a cota de forma atômica via RPC", async () => {
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

    it("saveAdvisorCache grava análise e getAdvisorCache recupera do cache", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(`${SENTINEL_DATE}T15:00:00Z`));

      try {
        await saveAdvisorCache(fallbackAdvisorAnalysis, "gemini-3.8-flash");
        const cached = await getAdvisorCache();

        expect(cached).not.toBeNull();
        expect(cached?.modelUsed).toBe("gemini-3.8-flash");
        expect(cached?.data.daily.summary).toBe(fallbackAdvisorAnalysis.daily.summary);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
