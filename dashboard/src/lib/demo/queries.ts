import telemetryData from "./data/telemetry-day.json";
import dailyGenData from "./data/daily-generation.json";
import monthlyHistoryData from "./data/monthly-history.json";
import utilityDataJson from "./data/utility-data.json";
import forecastJson from "./data/open-meteo-forecast.json";
import archiveJson from "./data/open-meteo-archive.json";

import type {
  SolarTelemetryRow,
  UtilityDataRow,
  SunCurvePoint,
  GenerationPoint,
  MultiYearHistory,
  InverterMonthlyHistoryRow,
} from "@/lib/types";
import {
  buildSunCurveGrid,
  mergeDailyGeneration,
  buildMultiYearHistory,
  normalizeUnidadeConsumidora,
  type DailyGenerationEntry,
  type SunCurveRow,
} from "@/lib/queries";
import {
  toBrasiliaIsoDate,
  brasiliaClock,
  brasiliaIsoDaysAgo,
} from "@/lib/dates";
import {
  toWeatherRows,
  toDailyWeather,
  type OpenMeteoDaily,
} from "@/lib/weatherData";
import type { DailyWeather } from "@/lib/weather";
import { findGeneratorUcCode } from "@/lib/utility";

function getDemoNow(): Date {
  if (process.env.DEMO_NOW) {
    const parsed = new Date(process.env.DEMO_NOW);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export async function getDemoLatestTelemetry(): Promise<SolarTelemetryRow> {
  const now = getDemoNow();
  const { isDaytime, time } = brasiliaClock(now);
  const currentHour = Number(time.slice(0, 2));
  const currentMinute = Number(time.slice(3, 5));
  const nowTotalMinutes = currentHour * 60 + currentMinute;

  const rows = telemetryData as unknown as SolarTelemetryRow[];

  let selected = rows[rows.length - 1];
  let minDiff = Infinity;
  for (const r of rows) {
    const rowDate = new Date(r.recorded_at);
    const { time: rowTime } = brasiliaClock(rowDate);
    const rowHour = Number(rowTime.slice(0, 2));
    const rowMin = Number(rowTime.slice(3, 5));
    const rowTotal = rowHour * 60 + rowMin;
    const diff = Math.abs(rowTotal - nowTotalMinutes);
    if (diff < minDiff) {
      minDiff = diff;
      selected = r;
    }
  }

  if (!isDaytime) {
    return {
      ...selected,
      id: 9999,
      recorded_at: now.toISOString(),
      plant_name: "Usina Demo (16 kWp)",
      total_power_w: 0,
      total_power_kw: 0,
      capacity_factor_pct: 0,
      inverters_data: (selected.inverters_data || []).map((inv) => ({
        ...inv,
        status: "standby",
        power_w: 0,
        pv1: inv.pv1 ? { ...inv.pv1, w: 0, i: 0 } : null,
        pv2: inv.pv2 ? { ...inv.pv2, w: 0, i: 0 } : null,
      })),
      created_at: now.toISOString(),
    };
  }

  return {
    ...selected,
    id: 9999,
    recorded_at: now.toISOString(),
    plant_name: "Usina Demo (16 kWp)",
    created_at: now.toISOString(),
  };
}

export async function getDemoLatestUtilityData(): Promise<UtilityDataRow> {
  const raw = utilityDataJson as unknown as UtilityDataRow;
  const now = getDemoNow();

  const ucs = { ...raw.unidades_consumidoras };
  const generatorUcCode = findGeneratorUcCode(ucs);
  if (generatorUcCode) {
    ucs[generatorUcCode] = normalizeUnidadeConsumidora(ucs[generatorUcCode]);
  }

  return {
    ...raw,
    id: 1,
    titular: "Titular Demo",
    cpf: "000.000.000-00",
    distribuidora: "Cooperaliança (Içara/SC)",
    updated_at: now.toISOString(),
    unidades_consumidoras: ucs,
    generator_uc: generatorUcCode,
  };
}

export async function getDemoTodaySunCurve(): Promise<SunCurvePoint[]> {
  const now = getDemoNow();
  const todayIso = toBrasiliaIsoDate(now);
  const rows = telemetryData as unknown as SunCurveRow[];

  const shiftedRows = rows.map((r) => {
    const timePart = r.recorded_at.split("T")[1] || "12:00:00Z";
    return {
      ...r,
      recorded_at: `${todayIso}T${timePart}`,
    };
  });

  return buildSunCurveGrid(shiftedRows, todayIso, now);
}

export async function getDemoGenerationByDay(
  daysBack: number = 90,
): Promise<Record<string, DailyGenerationEntry>> {
  const now = getDemoNow();
  const rawData = dailyGenData as {
    view: Array<{ date: string; kwh: number }>;
    history: Array<{ date: string; inverter_id: string; kwh: number }>;
  };

  const viewRows: Array<{ date: string; kwh: number }> = [];
  const historyRows: Array<{ date: string; inverter_id: string; kwh: number }> =
    [];

  for (let i = 0; i < daysBack; i++) {
    const targetDate = brasiliaIsoDaysAgo(i, now);
    const viewFixture = rawData.view[i % rawData.view.length];
    if (viewFixture) {
      viewRows.push({ date: targetDate, kwh: viewFixture.kwh });
    }
  }

  const fixtureHistory = rawData.history || [];
  for (let i = 0; i < Math.min(daysBack, 60); i++) {
    const targetDate = brasiliaIsoDaysAgo(i, now);
    const subset = fixtureHistory.slice(i * 3, i * 3 + 3);
    for (const h of subset) {
      historyRows.push({
        date: targetDate,
        inverter_id: h.inverter_id,
        kwh: h.kwh,
      });
    }
  }

  return mergeDailyGeneration(viewRows, historyRows);
}

export async function getDemoMultiYearHistory(): Promise<MultiYearHistory> {
  const now = getDemoNow();
  const todayIso = toBrasiliaIsoDate(now);
  const currentYear = Number(todayIso.slice(0, 4));
  const currentMonthNum = Number(todayIso.slice(5, 7));

  const rawRows = monthlyHistoryData as InverterMonthlyHistoryRow[];

  let maxYearInFixture = 2026;
  for (const r of rawRows) {
    if (r.month) {
      const y = Number(r.month.slice(0, 4));
      if (y > maxYearInFixture) maxYearInFixture = y;
    }
  }
  const yearDelta = currentYear - maxYearInFixture;

  const shiftedMonthlyRows: InverterMonthlyHistoryRow[] = rawRows.map((r) => {
    if (!r.month) return r;
    const y = Number(r.month.slice(0, 4));
    const m = r.month.slice(5, 7);
    return {
      ...r,
      month: `${y + yearDelta}-${m}`,
    };
  });

  const dailyFromMonth = `${currentYear}-${String(currentMonthNum).padStart(2, "0")}`;
  const daysSince = 35;
  const dailyEntries = await getDemoGenerationByDay(daysSince);

  return buildMultiYearHistory(
    shiftedMonthlyRows,
    dailyEntries,
    dailyFromMonth,
    todayIso,
  );
}

export async function getDemoMonthlyGeneration(): Promise<GenerationPoint[]> {
  const history = await getDemoMultiYearHistory();
  return history.last12Months;
}

export async function getDemoYearlyGeneration(): Promise<GenerationPoint[]> {
  const history = await getDemoMultiYearHistory();
  return history.yearsTotals;
}

export async function getDemoIcaraWeatherData(): Promise<DailyWeather[]> {
  const now = getDemoNow();
  const todayIso = toBrasiliaIsoDate(now);
  const forecastDaily = (forecastJson as { daily: OpenMeteoDaily }).daily;
  const archiveDaily = (archiveJson as { daily: OpenMeteoDaily }).daily;

  const forecastRows = toWeatherRows(forecastDaily, "forecast");
  const archiveRows = toWeatherRows(archiveDaily, "archive");
  const combined = [...archiveRows, ...forecastRows];

  const totalDays = combined.length;
  const dailyEntries = await getDemoGenerationByDay(90);

  const result: DailyWeather[] = [];
  for (let i = 80; i >= -6; i--) {
    const targetDate = brasiliaIsoDaysAgo(i, now);
    const fixtureIdx = Math.abs((80 - i) % totalDays);
    const row = combined[fixtureIdx];
    if (row) {
      const shiftedRow = { ...row, date: targetDate };
      const actualGen = dailyEntries[targetDate];
      result.push(toDailyWeather(shiftedRow, todayIso, actualGen));
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
