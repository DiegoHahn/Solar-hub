import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getDemoLatestTelemetry,
  getDemoLatestUtilityData,
  getDemoTodaySunCurve,
  getDemoGenerationByDay,
  getDemoMultiYearHistory,
  getDemoMonthlyGeneration,
  getDemoYearlyGeneration,
  getDemoIcaraWeatherData,
} from "./queries";
import * as datesModule from "@/lib/dates";

describe("demo/queries", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getDemoLatestTelemetry", () => {
    it("retorna telemetria com potência zerada e inversores em standby quando fora do horário solar (noite)", async () => {
      // Simula horário noturno: 22:30
      vi.spyOn(datesModule, "brasiliaClock").mockReturnValue({
        time: "22:30",
        isDaytime: false,
      });

      const result = await getDemoLatestTelemetry();
      expect(result.plant_name).toBe("Usina Demo (16 kWp)");
      expect(result.id).toBe(9999);
      expect(result.total_power_w).toBe(0);
      expect(result.total_power_kw).toBe(0);
      expect(result.capacity_factor_pct).toBe(0);

      for (const inv of result.inverters_data) {
        expect(inv.status).toBe("standby");
        expect(inv.power_w).toBe(0);
        if (inv.pv1) {
          expect(inv.pv1.w).toBe(0);
          expect(inv.pv1.i).toBe(0);
        }
        if (inv.pv2) {
          expect(inv.pv2.w).toBe(0);
          expect(inv.pv2.i).toBe(0);
        }
      }
    });

    it("retorna telemetria com dados ativos quando dentro do horário solar (dia)", async () => {
      // Simula horário diurno: 12:30
      vi.spyOn(datesModule, "brasiliaClock").mockReturnValue({
        time: "12:30",
        isDaytime: true,
      });

      const result = await getDemoLatestTelemetry();
      expect(result.plant_name).toBe("Usina Demo (16 kWp)");
      expect(result.id).toBe(9999);
      expect(typeof result.total_power_w).toBe("number");
      expect(result.inverters_data.length).toBeGreaterThan(0);
    });
  });

  describe("getDemoLatestUtilityData", () => {
    it("anonimiza titular e cpf e normaliza a UC geradora", async () => {
      const result = await getDemoLatestUtilityData();

      expect(result.titular).toBe("Titular Demo");
      expect(result.cpf).toBe("000.000.000-00");
      expect(result.distribuidora).toBe("Cooperaliança (Içara/SC)");

      const generator = result.unidades_consumidoras[result.generator_uc!];
      expect(generator.geracao_distribuida?.PotenciaInstalada).toBeGreaterThan(0);
      expect(generator.geracao_distribuida?.ValorProximoSaldoVencer).toBeGreaterThan(0);
      expect(generator).toHaveProperty("extrato_gd");
      expect(generator).toHaveProperty("balanco_energetico");
    });
  });

  describe("getDemoTodaySunCurve", () => {
    it("retorna 31 pontos espaçados em 30 minutos (das 05:00 às 20:00) para o dia de hoje", async () => {
      const result = await getDemoTodaySunCurve();
      expect(result.length).toBe(31);
      expect(result[0]).toHaveProperty("time");
      expect(result[0]).toHaveProperty("power_kw");
    });
  });

  describe("getDemoGenerationByDay", () => {
    it("gera histórico de geração para a quantidade de dias solicitada", async () => {
      const result7 = await getDemoGenerationByDay(7);
      expect(Object.keys(result7).length).toBe(7);

      const result30 = await getDemoGenerationByDay(30);
      expect(Object.keys(result30).length).toBe(30);

      // Cada entrada tem kwh e inverters
      const firstEntry = Object.values(result30)[0];
      expect(firstEntry).toHaveProperty("kwh");
      expect(typeof firstEntry.kwh).toBe("number");
    });
  });

  describe("getDemoMultiYearHistory, getDemoMonthlyGeneration e getDemoYearlyGeneration", () => {
    it("retorna histórico multi-ano ajustado para o ano atual", async () => {
      const history = await getDemoMultiYearHistory();
      expect(history).toHaveProperty("yearsTotals");
      expect(history).toHaveProperty("last12Months");
      expect(history.last12Months.length).toBe(12);

      const currentYear = new Date().getFullYear().toString();
      const hasCurrentYear = history.yearsTotals.some((y) => y.label === currentYear);
      expect(hasCurrentYear).toBe(true);
    });

    it("retorna geração mensal e anual a partir de getDemoMonthlyGeneration e getDemoYearlyGeneration", async () => {
      const monthly = await getDemoMonthlyGeneration();
      expect(monthly.length).toBe(12);

      const yearly = await getDemoYearlyGeneration();
      expect(yearly.length).toBeGreaterThan(0);
    });
  });

  describe("getDemoIcaraWeatherData", () => {
    it("retorna previsão e histórico de clima combinados e ordenados por data", async () => {
      const weather = await getDemoIcaraWeatherData();
      expect(weather.length).toBeGreaterThan(0);

      // Verifica ordenação cronológica
      for (let i = 1; i < weather.length; i++) {
        expect(weather[i].date >= weather[i - 1].date).toBe(true);
      }

      // Verifica campos essenciais
      const sample = weather[0];
      expect(sample).toHaveProperty("date");
      expect(sample).toHaveProperty("tempMax");
      expect(sample).toHaveProperty("tempMin");
      expect(sample).toHaveProperty("weatherCode");
    });
  });

  describe("suporte a DEMO_NOW", () => {
    it("utiliza a data fixada por DEMO_NOW para determinar o relógio da demo", async () => {
      const originalEnv = process.env.DEMO_NOW;
      try {
        process.env.DEMO_NOW = "2026-10-02T13:30:00-03:00";
        const result = await getDemoLatestTelemetry();
        expect(result.plant_name).toBe("Usina Demo (16 kWp)");
        expect(result.total_power_w).toBeGreaterThan(0);
      } finally {
        process.env.DEMO_NOW = originalEnv;
      }
    });
  });
});

