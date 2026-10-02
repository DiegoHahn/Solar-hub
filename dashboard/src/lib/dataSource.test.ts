import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isDemoMode,
  getDataSource,
} from "./dataSource";
import * as demoQueries from "./demo/queries";
import * as realQueries from "./queries";
import * as realWeather from "./weatherData";

const mockCookieGet = vi.fn();
const mockCookieGetAll = vi.fn();
const mockGetUser = vi.fn();
const mockCreateClient = vi.fn(async () => ({
  auth: {
    getUser: mockGetUser,
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
    getAll: mockCookieGetAll,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

describe("dataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isDemoMode", () => {
    it("retorna false se não houver cookie solarhub_demo", async () => {
      mockCookieGet.mockReturnValue(undefined);
      const result = await isDemoMode();
      expect(result).toBe(false);
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("retorna false se o valor de solarhub_demo for diferente de 1", async () => {
      mockCookieGet.mockReturnValue({ value: "0" });
      const result = await isDemoMode();
      expect(result).toBe(false);
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("retorna true e NUNCA chama createClient se houver cookie solarhub_demo e nenhum cookie supabase", async () => {
      mockCookieGet.mockReturnValue({ value: "1" });
      mockCookieGetAll.mockReturnValue([
        { name: "solarhub_demo", value: "1" },
        { name: "other_cookie", value: "xyz" },
      ]);

      const result = await isDemoMode();
      expect(result).toBe(true);
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("retorna false se houver cookie de demo mas também usuário logado no Supabase (usuário logado tem prioridade)", async () => {
      mockCookieGet.mockReturnValue({ value: "1" });
      mockCookieGetAll.mockReturnValue([
        { name: "solarhub_demo", value: "1" },
        { name: "sb-solarhub-auth-token", value: "token123" },
      ]);
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-1", email: "diego@solarhub.local" } },
      });

      const result = await isDemoMode();
      expect(result).toBe(false);
      expect(mockCreateClient).toHaveBeenCalled();
    });

    it("retorna true se houver cookie de auth do Supabase mas a sessão estiver expirada/nula", async () => {
      mockCookieGet.mockReturnValue({ value: "1" });
      mockCookieGetAll.mockReturnValue([
        { name: "solarhub_demo", value: "1" },
        { name: "sb-solarhub-auth-token", value: "expired" },
      ]);
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
      });

      const result = await isDemoMode();
      expect(result).toBe(true);
    });

    it("retorna true como fallback se a checagem do Supabase lançar exceção", async () => {
      mockCookieGet.mockReturnValue({ value: "1" });
      mockCookieGetAll.mockReturnValue([
        { name: "solarhub_demo", value: "1" },
        { name: "sb-solarhub-auth-token", value: "err" },
      ]);
      mockGetUser.mockRejectedValueOnce(new Error("Supabase indisponível"));

      const result = await isDemoMode();
      expect(result).toBe(true);
    });
  });

  describe("getDataSource - Isolamento Estrito em Modo Demo", () => {
    beforeEach(() => {
      mockCookieGet.mockReturnValue({ value: "1" });
      mockCookieGetAll.mockReturnValue([{ name: "solarhub_demo", value: "1" }]);
    });

    it("retorna DataSource com isDemo: true e funções apontadas para demoQueries", async () => {
      const ds = await getDataSource();
      expect(ds.isDemo).toBe(true);
      expect(ds.getLatestTelemetry).toBe(demoQueries.getDemoLatestTelemetry);
      expect(ds.getLatestUtilityData).toBe(demoQueries.getDemoLatestUtilityData);
      expect(ds.getTodaySunCurve).toBe(demoQueries.getDemoTodaySunCurve);
      expect(ds.getGenerationByDay).toBe(demoQueries.getDemoGenerationByDay);
      expect(ds.getMonthlyGeneration).toBe(demoQueries.getDemoMonthlyGeneration);
      expect(ds.getMultiYearHistory).toBe(demoQueries.getDemoMultiYearHistory);
      expect(ds.getYearlyGeneration).toBe(demoQueries.getDemoYearlyGeneration);
      expect(ds.getIcaraWeatherData).toBe(demoQueries.getDemoIcaraWeatherData);
    });

    it("executa todas as consultas de demo sem tocar no Supabase", async () => {
      mockCreateClient.mockImplementation(() => {
        throw new Error("SUPABASE NÃO DEVE SER CHAMADO EM MODO DEMO!");
      });

      const ds = await getDataSource();
      const telemetry = await ds.getLatestTelemetry();
      const utility = await ds.getLatestUtilityData();
      const sunCurve = await ds.getTodaySunCurve();
      const genByDay = await ds.getGenerationByDay(7);
      const monthly = await ds.getMonthlyGeneration();
      const multiYear = await ds.getMultiYearHistory();
      const yearly = await ds.getYearlyGeneration();
      const weather = await ds.getIcaraWeatherData();

      expect(telemetry).not.toBeNull();
      expect(utility).not.toBeNull();
      expect(Array.isArray(sunCurve)).toBe(true);
      expect(typeof genByDay).toBe("object");
      expect(Array.isArray(monthly)).toBe(true);
      expect(multiYear).toHaveProperty("yearsTotals");
      expect(Array.isArray(yearly)).toBe(true);
      expect(Array.isArray(weather)).toBe(true);

      // Garantia absoluta de zero chamadas ao cliente Supabase
      expect(mockCreateClient).not.toHaveBeenCalled();
    });
  });

  describe("getDataSource - Modo Real (não demo)", () => {
    beforeEach(() => {
      mockCookieGet.mockReturnValue(undefined);
      mockCookieGetAll.mockReturnValue([]);
    });

    it("retorna DataSource com isDemo: false e funções apontadas para queries reais", async () => {
      const ds = await getDataSource();
      expect(ds.isDemo).toBe(false);
      expect(ds.getLatestTelemetry).toBe(realQueries.getLatestTelemetry);
      expect(ds.getLatestUtilityData).toBe(realQueries.getLatestUtilityData);
      expect(ds.getTodaySunCurve).toBe(realQueries.getTodaySunCurve);
      expect(ds.getGenerationByDay).toBe(realQueries.getGenerationByDay);
      expect(ds.getMonthlyGeneration).toBe(realQueries.getMonthlyGeneration);
      expect(ds.getMultiYearHistory).toBe(realQueries.getMultiYearHistory);
      expect(ds.getYearlyGeneration).toBe(realQueries.getYearlyGeneration);
      expect(ds.getIcaraWeatherData).toBe(realWeather.getIcaraWeatherData);
    });
  });
});

