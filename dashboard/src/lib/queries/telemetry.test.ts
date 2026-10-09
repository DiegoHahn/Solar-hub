import { describe, expect, it } from "vitest";

import { buildSunCurveGrid, type SunCurveRow } from "./telemetry";

import telemetryDayFixtureRaw from "../../test/fixtures/telemetry-day.json";

const telemetryDayFixture = telemetryDayFixtureRaw as unknown as SunCurveRow[];

describe("buildSunCurveGrid", () => {
  const targetDate = "2026-09-29";

  it("generates a fixed 30-minute interval grid from 05:00 to 20:00 (31 points)", () => {
    const nighttime = new Date(`${targetDate}T22:00:00-03:00`);
    const grid = buildSunCurveGrid(telemetryDayFixture, targetDate, nighttime);

    expect(grid).toHaveLength(31);
    expect(grid[0].time).toBe("05:00");
    expect(grid[grid.length - 1].time).toBe("20:00");
    expect(grid.every((p) => p.nominal_cap_kw === 16.0)).toBe(true);
  });

  it("sets slots subsequent to current time (now) to null during daytime", () => {
    const afternoon = new Date(`${targetDate}T12:00:00-03:00`);
    const grid = buildSunCurveGrid(telemetryDayFixture, targetDate, afternoon);

    const pastOrPresent = grid.filter((p) => p.time <= "12:00");
    const future = grid.filter((p) => p.time > "12:00");

    expect(pastOrPresent.every((p) => p.power_kw !== null)).toBe(true);
    expect(future.every((p) => p.power_kw === null)).toBe(true);
  });

  it("only fills a slot after its timestamp has been reached", () => {
    const beforeFive = new Date(`${targetDate}T16:53:00-03:00`);
    const grid = buildSunCurveGrid(telemetryDayFixture, targetDate, beforeFive);
    const slot = (time: string) => grid.find((p) => p.time === time)!;

    expect(slot("16:30").power_kw).not.toBeNull();
    expect(slot("17:00").power_kw).toBeNull();
  });

  it("keeps all slots filled when now is after 20:00", () => {
    const night = new Date(`${targetDate}T21:30:00-03:00`);
    const grid = buildSunCurveGrid(telemetryDayFixture, targetDate, night);

    expect(grid.every((p) => p.power_kw !== null)).toBe(true);
  });
});
