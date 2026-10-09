import { describe, expect, it } from "vitest";

import {
  buildMultiYearHistory,
  currentMonthGenerationKwh,
  mergeDailyGeneration,
  type DailyGenerationRow,
  type InverterDailyHistoryRow,
} from "./generation";
import type { InverterMonthlyHistoryRow } from "../types";
import { en } from "@/i18n/locales/en";
import { ptBR } from "@/i18n/locales/pt-BR";

import dailyGenFixture from "../../test/fixtures/daily-generation.json";
import monthlyHistoryFixture from "../../test/fixtures/monthly-history.json";

describe("mergeDailyGeneration", () => {
  it("overwrites telemetry view with finalized daily history data", () => {
    const viewRows: DailyGenerationRow[] = [
      { date: "2026-08-27", kwh: 35.0 },
      { date: "2026-08-28", kwh: 40.0 },
    ];
    const historyRows: InverterDailyHistoryRow[] = [
      { date: "2026-08-27", inverter_id: "plant_total", kwh: 48.5, is_estimated: false },
    ];

    const merged = mergeDailyGeneration(viewRows, historyRows);
    expect(merged["2026-08-27"]).toEqual({ kwh: 48.5, isReal: true });
    expect(merged["2026-08-28"]).toEqual({ kwh: 40.0, isReal: true });
  });

  it("marks isReal as false when the history record is calibrated/estimated", () => {
    const viewRows: DailyGenerationRow[] = [{ date: "2026-08-27", kwh: 30.0 }];
    const historyRows: InverterDailyHistoryRow[] = [
      { date: "2026-08-27", inverter_id: "plant_total", kwh: 45.0, is_estimated: true },
    ];

    const merged = mergeDailyGeneration(viewRows, historyRows);
    expect(merged["2026-08-27"]).toEqual({ kwh: 45.0, isReal: false });
  });

  it("sums goodwe_combined + inv_1 when plant_total is missing from history", () => {
    const viewRows: DailyGenerationRow[] = [];
    const historyRows: InverterDailyHistoryRow[] = [
      { date: "2026-08-27", inverter_id: "inv_1", kwh: 20.0, is_estimated: false },
      { date: "2026-08-27", inverter_id: "goodwe_combined", kwh: 30.5, is_estimated: false },
    ];

    const merged = mergeDailyGeneration(viewRows, historyRows);
    expect(merged["2026-08-27"]).toEqual({ kwh: 50.5, isReal: true });
  });

  it("successfully processes real data from daily-generation.json fixture", () => {
    const merged = mergeDailyGeneration(
      dailyGenFixture.view as DailyGenerationRow[],
      dailyGenFixture.history as InverterDailyHistoryRow[],
    );
    const dates = Object.keys(merged);
    expect(dates.length).toBeGreaterThan(30);

    for (const d of dates) {
      expect(merged[d].kwh).toBeGreaterThanOrEqual(0);
      expect(typeof merged[d].isReal).toBe("boolean");
    }
  });
});

describe("currentMonthGenerationKwh", () => {
  const view = (dailyGenFixture as { view: DailyGenerationRow[] }).view;
  const byDay = mergeDailyGeneration(view, []);
  const dates = Object.keys(byDay).sort();
  const lastDay = dates[dates.length - 1];
  const monthPrefix = lastDay.slice(0, 8);

  it("sums only the days of the current month up to today", () => {
    const expected = dates
      .filter((d) => d.startsWith(monthPrefix))
      .reduce((sum, d) => sum + byDay[d].kwh, 0);

    expect(expected).toBeGreaterThan(0);
    expect(currentMonthGenerationKwh(byDay, lastDay)).toBeCloseTo(expected, 1);
  });

  it("ignores days from the previous month", () => {
    const [year, month] = lastDay.split("-").map(Number);
    const nextMonthDay = month === 12 ? `${year + 1}-01-05` : `${year}-${String(month + 1).padStart(2, "0")}-05`;

    expect(currentMonthGenerationKwh(byDay, nextMonthDay)).toBe(0);
  });

  it("ignores days after today", () => {
    const firstOfMonth = `${monthPrefix}01`;
    const upToFirst = byDay[firstOfMonth]?.kwh ?? 0;

    expect(currentMonthGenerationKwh(byDay, firstOfMonth)).toBeCloseTo(upToFirst, 1);
  });

  it("returns zero when the month has no generation yet", () => {
    expect(currentMonthGenerationKwh(byDay, "2099-01-15")).toBe(0);
  });
});

describe("buildMultiYearHistory", () => {
  it("regression test: month starting from dailyFromMonth uses daily sum instead of partial monthly table value", () => {
    const monthlyRows: InverterMonthlyHistoryRow[] = [
      { month: "2026-08", inverter_id: "plant_total", kwh: 1200 },
      { month: "2026-09", inverter_id: "plant_total", kwh: 300 }, // partial/incomplete value in monthly table
    ];

    const dailyEntries = {
      "2026-09-01": { kwh: 50, isReal: true },
      "2026-09-02": { kwh: 60, isReal: true },
      "2026-09-03": { kwh: 70, isReal: true },
    };

    const history = buildMultiYearHistory(monthlyRows, dailyEntries, "2026-09", "2026-09-29", en.common.monthsShort);

    // In 2026, September should reflect daily sum (50 + 60 + 70 = 180), not the partial 300
    const points2026 = history.byYear["2026"];
    expect(points2026).toBeDefined();

    const sepPoint = points2026.find((p) => p.label === "Sep");
    expect(sepPoint?.kwh).toBe(180);

    const augPoint = points2026.find((p) => p.label === "Aug");
    expect(augPoint?.kwh).toBe(1200);
  });

  it("builds consistent multi-year history from real monthly-history and daily-generation fixtures", () => {
    const monthlyRows = monthlyHistoryFixture as InverterMonthlyHistoryRow[];
    const dailyEntries = mergeDailyGeneration(
      dailyGenFixture.view as DailyGenerationRow[],
      dailyGenFixture.history as InverterDailyHistoryRow[],
    );

    const history = buildMultiYearHistory(monthlyRows, dailyEntries, "2026-09", "2026-09-29", en.common.monthsShort);

    expect(history.last12Months).toHaveLength(12);
    expect(history.availableYears.length).toBeGreaterThanOrEqual(1);
    expect(history.yearsTotals.length).toBeGreaterThanOrEqual(1);

    for (const p of history.last12Months) {
      expect(p.kwh).toBeGreaterThanOrEqual(0);
    }
  });

  it("labels months in the language of the given month names", () => {
    const monthlyRows: InverterMonthlyHistoryRow[] = [{ month: "2026-02", inverter_id: "plant_total", kwh: 900 }];

    const english = buildMultiYearHistory(monthlyRows, {}, "2026-09", "2026-09-29", en.common.monthsShort);
    const portuguese = buildMultiYearHistory(monthlyRows, {}, "2026-09", "2026-09-29", ptBR.common.monthsShort);

    expect(english.byYear["2026"][1].label).toBe("Feb");
    expect(english.last12Months[0].label).toBe("Feb/26");
    expect(portuguese.byYear["2026"][1].label).toBe("Fev");
  });
});
