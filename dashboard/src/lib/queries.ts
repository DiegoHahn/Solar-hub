import { createClient } from "@/lib/supabase/server";
import type {
  SolarTelemetryRow,
  UtilityDataRow,
  UnidadeConsumidora,
  SunCurvePoint,
  GenerationPoint,
  MultiYearHistory,
  DailyWeatherRow,
  InverterMonthlyHistoryRow,
} from "@/lib/types";
import { findGeneratorUcCode } from "@/lib/utility";
import { brasiliaIsoDaysAgo, toBrasiliaIsoDate } from "@/lib/dates";

const NOMINAL_CAPACITY_KW = 16.0;
const TZ = "America/Sao_Paulo";

/** "DD/MM/YYYY HH:mm:ss" -> ["DD", "MM", "YYYY"] */
function splitCoopDate(raw: string | undefined): string[] {
  return (raw || "").split(" ")[0].split("/");
}

/**
 * Converts raw Cooperaliança API payload into domain structures consumed by the dashboard
 * (energy balance, GD extract) and fills gaps when portal endpoints return empty.
 */
export function normalizeUnidadeConsumidora(raw: UnidadeConsumidora): UnidadeConsumidora {
  const uc: UnidadeConsumidora = { ...raw };
  const hist12 = uc.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal;
  const gdStatement = uc.extrato_historico_gd?.RetornoDadosHistoricoGeracaoKwhNormal;

  if (!uc.balanco_energetico && hist12) {
    const rawBalanco = hist12.map((i) => {
      const parts = splitCoopDate(i.AnoMes);
      return {
        mes: `${parts[1]}/${parts[2]}`,
        injetado_kwh: i.KwhGerado,
        compensado_kwh: i.kwhCreditado,
        liquido_kwh: i.KwhGerado - i.kwhCreditado,
        saldo_kwh: i.Saldo,
      };
    });

    // Drops unbilled/open future months sent as all-zero from end of history
    while (
      rawBalanco.length > 1 &&
      rawBalanco[rawBalanco.length - 1].injetado_kwh === 0 &&
      rawBalanco[rawBalanco.length - 1].compensado_kwh === 0 &&
      rawBalanco[rawBalanco.length - 1].saldo_kwh === 0
    ) {
      rawBalanco.pop();
    }

    uc.balanco_energetico = rawBalanco;
  }

  if (!uc.extrato_gd && gdStatement) {
    uc.extrato_gd = gdStatement.map((e) => {
      const isInjetada = (e.Operacao || "").includes("Energia injetada");
      const rawDate = e.MesGeracao?.startsWith("01/01/0001") ? e.MesFaturamento : e.MesGeracao;
      const parts = splitCoopDate(rawDate || e.MesFaturamento);
      return {
        tipo: isInjetada ? "injetada" : "compensada",
        mes: `${parts[1]}/${parts[2]}`,
        kwh: isInjetada ? e.KwhGerado : e.kwhCreditado,
        saldo: e.Saldo,
        grupo: e.GrupoTransicaoLei14300 === 2 ? 2 : 1,
      };
    });
  }

  // Normalizes geracao_distribuida ensuring balance and capacity if object is empty
  const gd = uc.geracao_distribuida;
  if (!gd || Object.keys(gd).length === 0 || !gd.ValorProximoSaldoVencer) {
    // Extracts latest balance from GD extract or 12-month chart
    const histItems = hist12 || [];
    const fallbackBalance = gdStatement?.[0]?.Saldo ?? histItems[histItems.length - 1]?.Saldo ?? 9900;

    uc.geracao_distribuida = {
      ...gd,
      ValorProximoSaldoVencer: gd?.ValorProximoSaldoVencer || fallbackBalance,
      ProximoSaldoVencer: gd?.ProximoSaldoVencer ? gd.ProximoSaldoVencer.split(" ")[0] : undefined,
      PotenciaInstalada: gd?.PotenciaInstalada || NOMINAL_CAPACITY_KW,
      PercentualFatUcGeradora: gd?.PercentualFatUcGeradora || 100,
    };
  } else if (gd.ProximoSaldoVencer) {
    gd.ProximoSaldoVencer = gd.ProximoSaldoVencer.split(" ")[0];
  }

  // Normalizes resumo_ultima_fatura if portal endpoint returned empty
  const resumo = uc.resumo_ultima_fatura;
  if (!resumo || Object.keys(resumo).length === 0 || resumo.ValorFatura === undefined) {
    const bills = uc.historico_faturas_60_meses || [];
    const lastBill = bills[bills.length - 1];
    if (lastBill) {
      const yearMonthParts = splitCoopDate(lastBill.AnoMes);
      uc.resumo_ultima_fatura = {
        ValorFatura: lastBill.ValorTotal ?? 0,
        KwhReal: lastBill.ConsumoFaturado ?? 0,
        AnoMes: yearMonthParts.length >= 3 ? `${yearMonthParts[1]}/${yearMonthParts[2]}` : "—",
        DataLProxima: lastBill.Vcto ? lastBill.Vcto.split(" ")[0] : "—",
      };
    }
  } else {
    if (resumo.DataLProxima) {
      resumo.DataLProxima = resumo.DataLProxima.split(" ")[0];
    }
    if (resumo.AnoMes) {
      resumo.AnoMes = resumo.AnoMes.split(" ")[0];
    }
  }

  return uc;
}

export async function getLatestTelemetry(): Promise<SolarTelemetryRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solar_telemetry")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? (data as unknown as SolarTelemetryRow) : null;
}

export async function getLatestUtilityData(): Promise<UtilityDataRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("utility_data")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<UtilityDataRow>();

  if (error) throw error;

  if (!data) return null;

  const generatorUc = findGeneratorUcCode(data.unidades_consumidoras);
  if (generatorUc) {
    data.unidades_consumidoras[generatorUc] = normalizeUnidadeConsumidora(data.unidades_consumidoras[generatorUc]);
  }

  return { ...data, generator_uc: generatorUc };
}

export type SunCurveRow = Pick<SolarTelemetryRow, "recorded_at" | "total_power_kw" | "inverters_data">;

const SLOT_MINUTES = 30;
const SLOT_MATCH_WINDOW_MS = 20 * 60 * 1000;

/**
 * Builds fixed 30-minute daily grid from 05:00 to 20:00 in Brasília timezone.
 * This interval covers 100% of the solar window in Içara/SC on the longest day of the year
 * (summer solstice on Dec 21: sunrise at 05:14 and sunset at 19:16).
 * Future slots (after `now`) are set to null to preserve a fixed X-axis without drawing false lines.
 */
export function buildSunCurveGrid(
  rows: SunCurveRow[],
  todayIso: string,
  now: Date = new Date(),
): SunCurvePoint[] {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

  const rawPoints = rows.map((row) => {
    const invs = row.inverters_data || [];
    const powerOf = (id: string) => invs.find((i) => i.id === id)?.power_w || 0;
    return {
      time: formatTime(new Date(row.recorded_at)),
      timestamp: new Date(row.recorded_at).getTime(),
      power_kw: Number((row.total_power_kw || 0).toFixed(2)),
      nominal_cap_kw: NOMINAL_CAPACITY_KW,
      solis_kw: Number((powerOf("inv_1") / 1000).toFixed(2)),
      goodwe1_kw: Number((powerOf("inv_2") / 1000).toFixed(2)),
      goodwe2_kw: Number((powerOf("inv_3") / 1000).toFixed(2)),
    };
  });

  const grid: SunCurvePoint[] = [];
  const startSlot = new Date(`${todayIso}T05:00:00-03:00`);
  const endSlot = new Date(`${todayIso}T20:00:00-03:00`);
  const nowMs = now.getTime();

  const currentSlot = new Date(startSlot);
  while (currentSlot <= endSlot) {
    const slotTimeMs = currentSlot.getTime();
    const isFuture = slotTimeMs > nowMs;

    if (isFuture) {
      grid.push({
        time: formatTime(currentSlot),
        power_kw: null,
        nominal_cap_kw: NOMINAL_CAPACITY_KW,
        solis_kw: null,
        goodwe1_kw: null,
        goodwe2_kw: null,
      });
    } else {
      let closest: (typeof rawPoints)[number] | null = null;
      let closestDiff = Infinity;
      for (const p of rawPoints) {
        const diff = Math.abs(p.timestamp - slotTimeMs);
        if (diff < closestDiff) {
          closest = p;
          closestDiff = diff;
        }
      }
      const matched = closestDiff <= SLOT_MATCH_WINDOW_MS ? closest : null;

      grid.push({
        time: formatTime(currentSlot),
        power_kw: matched?.power_kw ?? 0,
        nominal_cap_kw: NOMINAL_CAPACITY_KW,
        solis_kw: matched?.solis_kw ?? 0,
        goodwe1_kw: matched?.goodwe1_kw ?? 0,
        goodwe2_kw: matched?.goodwe2_kw ?? 0,
      });
    }

    currentSlot.setMinutes(currentSlot.getMinutes() + SLOT_MINUTES);
  }

  return grid;
}

export async function getTodaySunCurve(): Promise<SunCurvePoint[]> {
  try {
    const now = new Date();
    const todayIso = toBrasiliaIsoDate(now);
    const startOfFetch = new Date(`${todayIso}T04:30:00-03:00`);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("solar_telemetry")
      .select("recorded_at, total_power_kw, inverters_data")
      .gte("recorded_at", startOfFetch.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(300);

    if (error) {
      console.error("Error querying daily curve from Supabase:", error);
      return [];
    }

    return buildSunCurveGrid((data ?? []) as unknown as SunCurveRow[], todayIso, now);
  } catch (err) {
    console.error("Error querying daily curve from Supabase:", err);
    return [];
  }
}

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

export async function getMonthlyGeneration(): Promise<GenerationPoint[]> {
  try {
    const byDay = await getGenerationByDay(31);
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, { kwh }]) => {
        const parts = iso.split("-");
        return {
          label: `${parts[2]}/${parts[1]}`,
          kwh,
        };
      });
  } catch (err) {
    console.error("Error calculating monthly generation:", err);
    return [];
  }
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * Builds multi-year gross generation history from `inverter_monthly_history`.
 * Months from `dailyFromMonth` (YYYY-MM) onward are summed from daily telemetry,
 * as the latest month imported into monthly table might be partial and subsequent months do not exist in it yet.
 */
export function buildMultiYearHistory(
  monthlyRows: InverterMonthlyHistoryRow[],
  dailyEntries: Record<string, DailyGenerationEntry>,
  dailyFromMonth: string,
  todayIso: string,
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
      pts.push({ label: MONTH_NAMES[m - 1], kwh: Math.round(months[m] || 0) });
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
      label: `${MONTH_NAMES[mIndex]}/${parts[0].slice(-2)}`,
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

export async function getMultiYearHistory(): Promise<MultiYearHistory> {
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

    return buildMultiYearHistory(monthlyRows, dailyEntries, dailyFromMonth, todayIso);
  } catch (err) {
    console.error("Error querying multi-year history:", err);
    return { last12Months: [], yearsTotals: [], byYear: {}, availableYears: [] };
  }
}

export async function getYearlyGeneration(): Promise<GenerationPoint[]> {
  const multi = await getMultiYearHistory();
  return multi.last12Months;
}

/** Daily weather stored from `startIso` (inclusive), in chronological order. */
export async function getStoredDailyWeather(startIso: string): Promise<DailyWeatherRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_weather")
    .select(
      "date, weather_code, temperature_max_c, temperature_min_c, sunshine_duration_s, shortwave_radiation_mj, precipitation_mm, source",
    )
    .gte("date", startIso)
    .order("date", { ascending: true });

  if (error) {
    console.error("Error reading daily_weather:", error);
    return [];
  }
  return (data ?? []) as DailyWeatherRow[];
}

/** Upserts weather days received from Open-Meteo by date. */
export async function saveDailyWeather(rows: DailyWeatherRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("daily_weather")
    .upsert(
      rows.map((r) => ({ ...r, updated_at: now })),
      { onConflict: "date" },
    );
  if (error) console.error("Error saving daily_weather:", error);
}
