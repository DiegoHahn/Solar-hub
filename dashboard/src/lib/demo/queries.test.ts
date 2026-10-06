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
    it("returns telemetry with zero power and inverters on standby outside sunlight hours (nighttime)", async () => {
      // Simulate nighttime: 22:30
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

    it("returns telemetry with active data during sunlight hours (daytime)", async () => {
      // Simulate daytime: 12:30
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
    it("anonymizes account holder and national ID and normalizes generating consumer unit", async () => {
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
    it("returns 31 points at 30-minute intervals (05:00 to 20:00) for today", async () => {
      const result = await getDemoTodaySunCurve();
      expect(result.length).toBe(31);
      expect(result[0]).toHaveProperty("time");
      expect(result[0]).toHaveProperty("power_kw");
    });
  });

  describe("getDemoGenerationByDay", () => {
    it("generates generation history for the requested number of days", async () => {
      const result7 = await getDemoGenerationByDay(7);
      expect(Object.keys(result7).length).toBe(7);

      const result30 = await getDemoGenerationByDay(30);
      expect(Object.keys(result30).length).toBe(30);

      // Each entry contains kwh and inverters
      const firstEntry = Object.values(result30)[0];
      expect(firstEntry).toHaveProperty("kwh");
      expect(typeof firstEntry.kwh).toBe("number");
    });
  });

  describe("getDemoMultiYearHistory, getDemoMonthlyGeneration and getDemoYearlyGeneration", () => {
    it("returns multi-year history adjusted to the current year", async () => {
      const history = await getDemoMultiYearHistory();
      expect(history).toHaveProperty("yearsTotals");
      expect(history).toHaveProperty("last12Months");
      expect(history.last12Months.length).toBe(12);

      const currentYear = new Date().getFullYear().toString();
      const hasCurrentYear = history.yearsTotals.some((y) => y.label === currentYear);
      expect(hasCurrentYear).toBe(true);
    });

    it("returns monthly and yearly generation from getDemoMonthlyGeneration and getDemoYearlyGeneration", async () => {
      const monthly = await getDemoMonthlyGeneration();
      expect(monthly.length).toBe(12);

      const yearly = await getDemoYearlyGeneration();
      expect(yearly.length).toBeGreaterThan(0);
    });
  });

  describe("getDemoIcaraWeatherData", () => {
    it("returns combined weather forecast and history sorted by date", async () => {
      const weather = await getDemoIcaraWeatherData();
      expect(weather.length).toBeGreaterThan(0);

      // Verify chronological ordering
      for (let i = 1; i < weather.length; i++) {
        expect(weather[i].date >= weather[i - 1].date).toBe(true);
      }

      // Verify essential fields
      const sample = weather[0];
      expect(sample).toHaveProperty("date");
      expect(sample).toHaveProperty("tempMax");
      expect(sample).toHaveProperty("tempMin");
      expect(sample).toHaveProperty("weatherCode");
    });
  });

  describe("support for DEMO_NOW", () => {
    it("uses fixed date from DEMO_NOW to determine demo clock", async () => {
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

