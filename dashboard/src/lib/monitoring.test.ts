import { describe, expect, it } from "vitest";
import { evaluateTelemetryHealth } from "./monitoring";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";

describe("evaluateTelemetryHealth", () => {
  // 12:00 BRT (15:00 UTC) - Daytime period
  const daytimeNow = new Date("2026-10-01T15:00:00.000Z");
  // 22:00 BRT (01:00 UTC next day) - Nighttime period
  const nighttimeNow = new Date("2026-10-02T01:00:00.000Z");

  it("returns ok: true when solar telemetry and utility data are up to date during daytime", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(daytimeNow.getTime() - 10 * 60 * 1000).toISOString() }, // 10 min ago
      utilityData: { updated_at: new Date(daytimeNow.getTime() - 2 * 60 * 60 * 1000).toISOString() }, // 2h ago
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

  it("alerts when solar telemetry is older than 30 minutes during daytime", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(daytimeNow.getTime() - 35 * 60 * 1000).toISOString() }, // 35 min ago
      utilityData: { updated_at: new Date(daytimeNow.getTime() - 2 * 60 * 60 * 1000).toISOString() },
      now: daytimeNow,
    });

    expect(report.ok).toBe(false);
    expect(report.solar.status).toBe("alert");
    expect(report.solar.ageMinutes).toBe(35);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("Solar telemetry outdated: last recorded 35m ago");
  });

  it("skips solar telemetry check during nighttime without alerting for absent generation", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(nighttimeNow.getTime() - 4 * 60 * 60 * 1000).toISOString() }, // 4h ago (sunset)
      utilityData: { updated_at: new Date(nighttimeNow.getTime() - 3 * 60 * 60 * 1000).toISOString() },
      now: nighttimeNow,
    });

    expect(report.ok).toBe(true);
    expect(report.isDaytime).toBe(false);
    expect(report.solar.status).toBe("skipped_night");
    expect(report.solar.message).toContain("Nighttime in Brasília");
    expect(report.errors).toHaveLength(0);
  });

  it("alerts when utility data is older than 26 hours even during nighttime", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(nighttimeNow.getTime() - 4 * 60 * 60 * 1000).toISOString() },
      utilityData: { updated_at: new Date(nighttimeNow.getTime() - 27 * 60 * 60 * 1000).toISOString() }, // 27h ago
      now: nighttimeNow,
    });

    expect(report.ok).toBe(false);
    expect(report.isDaytime).toBe(false);
    expect(report.utility.status).toBe("alert");
    expect(report.utility.ageHours).toBe(27);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("Utility data outdated: last updated 27h ago");
  });

  it("alerts when solar telemetry is missing (null) during daytime", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: null,
      utilityData: { updated_at: new Date(daytimeNow.getTime() - 1 * 60 * 60 * 1000).toISOString() },
      now: daytimeNow,
    });

    expect(report.ok).toBe(false);
    expect(report.solar.status).toBe("missing");
    expect(report.errors).toContain("No solar telemetry records found in database.");
  });

  it("alerts when utility data is missing (null)", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date(daytimeNow.getTime() - 5 * 60 * 1000).toISOString() },
      utilityData: null,
      now: daytimeNow,
    });

    expect(report.ok).toBe(false);
    expect(report.utility.status).toBe("missing");
    expect(report.errors).toContain("No utility records found in database.");
  });

  it("accumulates multiple errors when both collectors are outdated", () => {
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

  it("evaluates correctly using real fixture records", () => {
    // First fixture record saved at 13:50 UTC (10:50 BRT - daytime)
    const daytimeTelemetry = telemetryDayFixture[0];
    const recordedAtDate = new Date(daytimeTelemetry.recorded_at);
    // Simulates now 12 minutes after telemetry recording, during daytime
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

  it("defaults to current Date if `now` is not provided", () => {
    const report = evaluateTelemetryHealth({
      solarTelemetry: { recorded_at: new Date().toISOString() },
      utilityData: { updated_at: new Date().toISOString() },
    });

    expect(typeof report.isDaytime).toBe("boolean");
    expect(typeof report.brasiliaTime).toBe("string");
    expect(report.utility.status).toBe("ok");
  });
});

