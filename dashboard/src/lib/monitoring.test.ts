import { describe, expect, it } from "vitest";
import { evaluateTelemetryHealth } from "./monitoring";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";

describe("evaluateTelemetryHealth", () => {
  // 12:00 BRT (15:00 UTC) - Período diurno
  const daytimeNow = new Date("2026-10-01T15:00:00.000Z");
  // 22:00 BRT (01:00 UTC dia seguinte) - Período noturno
  const nighttimeNow = new Date("2026-10-02T01:00:00.000Z");

  it("retorna ok: true quando telemetria solar e dados da concessionária estão atualizados em horário diurno", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(daytimeNow.getTime() - 10 * 60 * 1000).toISOString() }, // 10 min atrás
      utilityData: { updated_at: new Date(daytimeNow.getTime() - 2 * 60 * 60 * 1000).toISOString() }, // 2h atrás
      now: daytimeNow,
    });

    expect(report.ok).toBe(true);
    expect(report.isDaytime).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.solar.status).toBe("ok");
    expect(report.solar.ageMinutes).toBe(10);
    expect(report.utility.status).toBe("ok");
    expect(report.utility.ageHours).toBe(2);
  });

  it("alerta quando telemetria solar tem mais de 30 minutos em horário diurno", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(daytimeNow.getTime() - 35 * 60 * 1000).toISOString() }, // 35 min atrás
      utilityData: { updated_at: new Date(daytimeNow.getTime() - 2 * 60 * 60 * 1000).toISOString() },
      now: daytimeNow,
    });

    expect(report.ok).toBe(false);
    expect(report.solar.status).toBe("alert");
    expect(report.solar.ageMinutes).toBe(35);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("Telemetria solar desatualizada: último registro há 35 min");
  });

  it("pula verificação de telemetria solar em horário noturno (sem alertar por ausência de sol)", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(nighttimeNow.getTime() - 4 * 60 * 60 * 1000).toISOString() }, // 4h atrás (ao pôr do sol)
      utilityData: { updated_at: new Date(nighttimeNow.getTime() - 3 * 60 * 60 * 1000).toISOString() },
      now: nighttimeNow,
    });

    expect(report.ok).toBe(true);
    expect(report.isDaytime).toBe(false);
    expect(report.solar.status).toBe("skipped_night");
    expect(report.solar.message).toContain("Horário noturno em Brasília");
    expect(report.errors).toHaveLength(0);
  });

  it("alerta quando concessionária tem mais de 26 horas mesmo durante a noite", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(nighttimeNow.getTime() - 4 * 60 * 60 * 1000).toISOString() },
      utilityData: { updated_at: new Date(nighttimeNow.getTime() - 27 * 60 * 60 * 1000).toISOString() }, // 27h atrás
      now: nighttimeNow,
    });

    expect(report.ok).toBe(false);
    expect(report.isDaytime).toBe(false);
    expect(report.utility.status).toBe("alert");
    expect(report.utility.ageHours).toBe(27);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("Dados da concessionária desatualizados: última atualização há 27 h");
  });

  it("alerta quando telemetria solar está ausente (null) em horário diurno", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: null,
      utilityData: { updated_at: new Date(daytimeNow.getTime() - 1 * 60 * 60 * 1000).toISOString() },
      now: daytimeNow,
    });

    expect(report.ok).toBe(false);
    expect(report.solar.status).toBe("missing");
    expect(report.errors).toContain("Nenhum registro de telemetria solar encontrado na base de dados.");
  });

  it("alerta quando dados da concessionária estão ausentes (null)", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(daytimeNow.getTime() - 5 * 60 * 1000).toISOString() },
      utilityData: null,
      now: daytimeNow,
    });

    expect(report.ok).toBe(false);
    expect(report.utility.status).toBe("missing");
    expect(report.errors).toContain("Nenhum registro de dados da concessionária encontrado na base de dados.");
  });

  it("acumula múltiplos erros quando ambos os coletores estão desatualizados", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(daytimeNow.getTime() - 50 * 60 * 1000).toISOString() }, // 50 min
      utilityData: { updated_at: new Date(daytimeNow.getTime() - 30 * 60 * 60 * 1000).toISOString() }, // 30h
      now: daytimeNow,
    });

    expect(report.ok).toBe(false);
    expect(report.solar.status).toBe("alert");
    expect(report.utility.status).toBe("alert");
    expect(report.errors).toHaveLength(2);
  });

  it("avalia corretamente usando dados reais das fixtures", () => {
    // Primeiro registro da fixture gravado às 13:50 UTC (10:50 BRT - diurno)
    const daytimeTelemetry = telemetryDayFixture[0];
    const recordedAtDate = new Date(daytimeTelemetry.recorded_at);
    // Simula now 12 minutos após a gravação da telemetria, em horário diurno
    const simulatedNow = new Date(recordedAtDate.getTime() + 12 * 60 * 1000);

    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: daytimeTelemetry.recorded_at },
      utilityData: { updated_at: new Date(simulatedNow.getTime() - 5 * 60 * 60 * 1000).toISOString() },
      now: simulatedNow,
    });

    expect(report.isDaytime).toBe(true);
    expect(report.solar.status).toBe("ok");
    expect(report.solar.ageMinutes).toBe(12);
    expect(report.solar.timestamp).toBe(daytimeTelemetry.recorded_at);
  });

  it("utiliza Date atual se `now` não for informado", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date().toISOString() },
      utilityData: { updated_at: new Date().toISOString() },
    });

    expect(typeof report.isDaytime).toBe("boolean");
    expect(typeof report.brasiliaTime).toBe("string");
    expect(report.utility.status).toBe("ok");
  });
});

