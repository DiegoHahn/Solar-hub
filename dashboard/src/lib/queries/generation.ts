import { createClient } from "@/lib/supabase/server";
import type { GenerationPoint, MultiYearHistory, InverterMonthlyHistoryRow } from "@/lib/types";
import { brasiliaIsoDaysAgo, toBrasiliaIsoDate } from "@/lib/dates";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/types";

export interface DailyGenerationRow {
  date: string | null; // YYYY-MM-DD (Brasília)
  kwh: number | string | null;
}

export interface InverterDailyHistoryRow {
  date: string;
  kwh: number | string | null;
  inverter_id: string;
  is_estimated?: boolean | null;
}

export interface DailyGenerationEntry {
  kwh: number;
  /** false when value originates from an estimated closure (e.g. calibrated from irradiance) */
  isReal: boolean;
}

/** Total generated in the calendar month of `todayIso` (YYYY-MM-DD, Brasília time), from 1st to today. */
export function currentMonthGenerationKwh(
  byDay: Record<string, DailyGenerationEntry>,
  todayIso: string,
): number {
  const monthPrefix = todayIso.slice(0, 8);
  const total = Object.entries(byDay)
    .filter(([date]) => date.startsWith(monthPrefix) && date <= todayIso)
    .reduce((sum, [, entry]) => sum + entry.kwh, 0);
  return Number(total.toFixed(1));
}

/**
 * Consolidates daily generation (kWh per day, key YYYY-MM-DD in Brasília timezone).
 * 1. Uses generation measured by telemetry (view daily_generation).
 * 2. Overwrites with closed history when present, prioritizing `plant_total`,
 *    then `goodwe_combined + inv_1`, then each individually; a day is only real
 *    if the underlying telemetry rows were measured.
 */
export function mergeDailyGeneration(
  generationRows: DailyGenerationRow[],
  historyRows: InverterDailyHistoryRow[],
): Record<string, DailyGenerationEntry> {
  const byDay: Record<string, DailyGenerationEntry> = {};

  for (const r of generationRows) {
    if (!r.date) continue;
    byDay[r.date] = { kwh: Number((Number(r.kwh) || 0).toFixed(1)), isReal: true };
  }

  const grouped: Record<string, Record<string, { kwh: number; estimated: boolean }>> = {};
  for (const r of historyRows) {
    if (!grouped[r.date]) grouped[r.date] = {};
    grouped[r.date][r.inverter_id] = { kwh: Number(r.kwh) || 0, estimated: Boolean(r.is_estimated) };
  }

  for (const [date, invs] of Object.entries(grouped)) {
    const { plant_total, goodwe_combined, inv_1 } = invs;
    const used = plant_total
      ? [plant_total]
      : [goodwe_combined, inv_1].filter((v): v is { kwh: number; estimated: boolean } => v !== undefined);
    if (used.length === 0) continue;

    const kwh = used.reduce((acc, v) => acc + v.kwh, 0);
    byDay[date] = { kwh: Number(kwh.toFixed(1)), isReal: used.every((v) => !v.estimated) };
  }

  return byDay;
}

/** Daily generation for the past `daysBack` days, indicating whether each value is measured or estimated. */
export async function getGenerationByDay(daysBack: number = 90): Promise<Record<string, DailyGenerationEntry>> {
  try {
    const startIso = brasiliaIsoDaysAgo(daysBack);
    const supabase = await createClient();
    const [histRes, genRes] = await Promise.all([
      supabase
        .from("inverter_daily_history")
        .select("date, kwh, inverter_id, is_estimated")
        .gte("date", startIso)
        .in("inverter_id", ["plant_total", "goodwe_combined", "inv_1"]),
      supabase.from("daily_generation").select("date, kwh").gte("date", startIso),
    ]);

    if (histRes.error) console.error("Error querying inverter_daily_history:", histRes.error);
    if (genRes.error) console.error("Error querying daily_generation:", genRes.error);

    return mergeDailyGeneration(genRes.data ?? [], histRes.data ?? []);
  } catch (err) {
    console.error("Error querying daily generation:", err);
    return {};
  }
}

/** One chart point per day in chronological order, labeled "DD/MM". */
export function toDailyGenerationPoints(byDay: Record<string, DailyGenerationEntry>): GenerationPoint[] {
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, { kwh }]) => {
      const parts = iso.split("-");
      return {
        label: `${parts[2]}/${parts[1]}`,
        kwh,
      };
    });
}

export async function getMonthlyGeneration(): Promise<GenerationPoint[]> {
  try {
    return toDailyGenerationPoints(await getGenerationByDay(31));
  } catch (err) {
    console.error("Error calculating monthly generation:", err);
    return [];
  }
}

/**
 * Builds multi-year gross generation history from `inverter_monthly_history`.
 * Months from `dailyFromMonth` (YYYY-MM) onward are summed from daily telemetry,
 * as the latest month imported into monthly table might be partial and subsequent months do not exist in it yet.
 * `monthNames` holds the twelve short month labels of the display language.
 */
export function buildMultiYearHistory(
  monthlyRows: InverterMonthlyHistoryRow[],
  dailyEntries: Record<string, DailyGenerationEntry>,
  dailyFromMonth: string,
  todayIso: string,
  monthNames: string[],
): MultiYearHistory {
  const currentYear = todayIso.slice(0, 4);
  const currentMonthNum = Number(todayIso.slice(5, 7));

  const groupedByMonth: Record<string, Record<string, number>> = {};
  for (const r of monthlyRows) {
    if (!r.month || !r.inverter_id) continue;
    if (!groupedByMonth[r.month]) groupedByMonth[r.month] = {};
    groupedByMonth[r.month][r.inverter_id] = Number(r.kwh) || 0;
  }

  const monthlyTotals: Record<string, number> = {};
  for (const [m, invs] of Object.entries(groupedByMonth)) {
    if (invs.plant_total !== undefined) {
      monthlyTotals[m] = invs.plant_total;
    } else if (invs.goodwe_combined !== undefined && invs.inv_1 !== undefined) {
      monthlyTotals[m] = invs.goodwe_combined + invs.inv_1;
    } else if (invs.goodwe_combined !== undefined) {
      monthlyTotals[m] = invs.goodwe_combined;
    } else if (invs.inv_1 !== undefined) {
      monthlyTotals[m] = invs.inv_1;
    } else {
      monthlyTotals[m] = Object.values(invs).reduce((acc, v) => acc + v, 0);
    }
  }

  const dailyTotals: Record<string, number> = {};
  for (const [dateIso, entry] of Object.entries(dailyEntries)) {
    const month = dateIso.slice(0, 7);
    if (month >= dailyFromMonth) dailyTotals[month] = (dailyTotals[month] || 0) + entry.kwh;
  }
  for (const [month, kwh] of Object.entries(dailyTotals)) {
    monthlyTotals[month] = Number(kwh.toFixed(1));
  }

  const allMonths = Object.keys(monthlyTotals).sort();
  const yearMonthMap: Record<string, Record<number, number>> = {};
  const yearTotalsMap: Record<string, number> = {};

  for (const m of allMonths) {
    const parts = m.split("-");
    const yStr = parts[0];
    const mNum = parseInt(parts[1], 10);
    const kwh = monthlyTotals[m] || 0;

    if (!yearMonthMap[yStr]) {
      yearMonthMap[yStr] = {};
      yearTotalsMap[yStr] = 0;
    }
    yearMonthMap[yStr][mNum] = (yearMonthMap[yStr][mNum] || 0) + kwh;
    yearTotalsMap[yStr] += kwh;
  }

  const availableYears = Object.keys(yearMonthMap).sort((a, b) => b.localeCompare(a)); // most recent first

  const byYear: Record<string, GenerationPoint[]> = {};
  for (const yr of availableYears) {
    const months = yearMonthMap[yr];
    const maxMonth = yr === currentYear ? currentMonthNum : 12;
    const pts: GenerationPoint[] = [];
    for (let m = 1; m <= maxMonth; m++) {
      pts.push({ label: monthNames[m - 1], kwh: Math.round(months[m] || 0) });
    }
    byYear[yr] = pts;
  }

  const yearsTotals: GenerationPoint[] = Object.keys(yearTotalsMap)
    .sort((a, b) => a.localeCompare(b))
    .map((yr) => ({ label: yr, kwh: Math.round(yearTotalsMap[yr]) }));

  const last12Keys = allMonths.slice(-12);
  const last12Months: GenerationPoint[] = last12Keys.map((m) => {
    const parts = m.split("-");
    const mIndex = parseInt(parts[1], 10) - 1;
    return {
      label: `${monthNames[mIndex]}/${parts[0].slice(-2)}`,
      kwh: Math.round(monthlyTotals[m] || 0),
    };
  });

  return {
    last12Months,
    yearsTotals,
    byYear,
    availableYears,
  };
}

export async function getMultiYearHistory(locale: Locale): Promise<MultiYearHistory> {
  try {
    const todayIso = toBrasiliaIsoDate(new Date());
    const supabase = await createClient();
    const monthlyRes = await supabase
      .from("inverter_monthly_history")
      .select("month, inverter_id, kwh, is_estimated")
      .order("month", { ascending: true });

    if (monthlyRes.error) {
      console.error("Error querying inverter_monthly_history:", monthlyRes.error);
    }
    const monthlyRows = monthlyRes.data ?? [];

    const dailyFromMonth = monthlyRows[monthlyRows.length - 1]?.month ?? todayIso.slice(0, 7);
    const daysSince = Math.ceil(
      (Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${dailyFromMonth}-01T00:00:00Z`)) / (24 * 60 * 60 * 1000),
    );
    const dailyEntries = await getGenerationByDay(daysSince + 1);

    return buildMultiYearHistory(
      monthlyRows,
      dailyEntries,
      dailyFromMonth,
      todayIso,
      getDictionary(locale).common.monthsShort,
    );
  } catch (err) {
    console.error("Error querying multi-year history:", err);
    return { last12Months: [], yearsTotals: [], byYear: {}, availableYears: [] };
  }
}

export async function getYearlyGeneration(locale: Locale): Promise<GenerationPoint[]> {
  const multi = await getMultiYearHistory(locale);
  return multi.last12Months;
}
