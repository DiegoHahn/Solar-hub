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
 * Converte o payload cru da Cooperaliança nas estruturas usadas pelo dashboard
 * (balanço energético, extrato GD) e preenche lacunas quando endpoints do portal vêm vazios.
 */
export function normalizeUnidadeConsumidora(raw: UnidadeConsumidora): UnidadeConsumidora {
  const uc: UnidadeConsumidora = { ...raw };
  const hist12 = uc.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal;
  const extrato = uc.extrato_historico_gd?.RetornoDadosHistoricoGeracaoKwhNormal;

  if (!uc.balanco_energetico && hist12) {
    uc.balanco_energetico = hist12.map((i) => {
      const parts = splitCoopDate(i.AnoMes);
      return {
        mes: `${parts[1]}/${parts[2]}`,
        injetado_kwh: i.KwhGerado,
        compensado_kwh: i.kwhCreditado,
        liquido_kwh: i.KwhGerado - i.kwhCreditado,
        saldo_kwh: i.Saldo,
      };
    });
  }

  if (!uc.extrato_gd && extrato) {
    uc.extrato_gd = extrato.map((e) => {
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

  // Normaliza geracao_distribuida garantindo saldo e potência se o objeto vier vazio
  const gd = uc.geracao_distribuida;
  if (!gd || Object.keys(gd).length === 0 || !gd.ValorProximoSaldoVencer) {
    // Extrai o saldo mais recente do extrato ou do gráfico de 12 meses
    const histItems = hist12 || [];
    const fallbackSaldo = extrato?.[0]?.Saldo ?? histItems[histItems.length - 1]?.Saldo ?? 9900;

    uc.geracao_distribuida = {
      ...gd,
      ValorProximoSaldoVencer: gd?.ValorProximoSaldoVencer || fallbackSaldo,
      ProximoSaldoVencer: gd?.ProximoSaldoVencer || "Próx. ciclo",
      PotenciaInstalada: gd?.PotenciaInstalada || NOMINAL_CAPACITY_KW,
      PercentualFatUcGeradora: gd?.PercentualFatUcGeradora || 100,
    };
  }

  // Normaliza resumo_ultima_fatura caso o endpoint do portal venha vazio
  const resumo = uc.resumo_ultima_fatura;
  if (!resumo || Object.keys(resumo).length === 0 || resumo.ValorFatura === undefined) {
    const faturas = uc.historico_faturas_60_meses || [];
    const lastFatura = faturas[faturas.length - 1];
    if (lastFatura) {
      const anoMesParts = splitCoopDate(lastFatura.AnoMes);
      uc.resumo_ultima_fatura = {
        ValorFatura: lastFatura.ValorTotal ?? 0,
        KwhReal: lastFatura.ConsumoFaturado ?? 0,
        AnoMes: anoMesParts.length >= 3 ? `${anoMesParts[1]}/${anoMesParts[2]}` : "—",
        DataLProxima: lastFatura.Vcto ? lastFatura.Vcto.split(" ")[0] : "—",
      };
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
  return data;
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
 * Monta a grade contínua de 30 em 30 minutos desde `startOfDay` até `now`, casando cada slot
 * com a leitura mais próxima (dentro de 20 min). Slots sem leitura ficam zerados.
 */
export function buildSunCurveGrid(rows: SunCurveRow[], startOfDay: Date, now: Date): SunCurvePoint[] {
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
  const currentSlot = new Date(startOfDay);

  while (currentSlot <= now) {
    const slotTimeMs = currentSlot.getTime();

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

    currentSlot.setMinutes(currentSlot.getMinutes() + SLOT_MINUTES);
  }

  return grid.length > 0 ? grid : rawPoints;
}

export async function getTodaySunCurve(): Promise<SunCurvePoint[]> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("solar_telemetry")
      .select("recorded_at, total_power_kw, inverters_data")
      .gte("recorded_at", todayStart.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(300);

    if (error || !data || data.length === 0) {
      return [];
    }

    return buildSunCurveGrid(data as SunCurveRow[], todayStart, new Date());
  } catch (err) {
    console.error("Erro ao buscar curva diária do Supabase:", err);
    return [];
  }
}

export interface DailyGenerationRow {
  date: string; // YYYY-MM-DD (Brasília)
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
  /** false quando o valor vem de um fechamento estimado (ex.: calibrado pela irradiação) */
  isReal: boolean;
}

/**
 * Consolida a geração diária (kWh por dia, chave YYYY-MM-DD no fuso de Brasília).
 * 1. Usa a geração medida pela telemetria (view daily_generation).
 * 2. Sobrescreve com o histórico fechado quando existir, priorizando `plant_total`,
 *    depois `goodwe_combined + inv_1`, depois cada um isoladamente; o dia só é real
 *    se as linhas usadas no valor forem medidas.
 */
export function mergeDailyGeneration(
  generationRows: DailyGenerationRow[],
  historyRows: InverterDailyHistoryRow[],
): Record<string, DailyGenerationEntry> {
  const byDay: Record<string, DailyGenerationEntry> = {};

  for (const r of generationRows) {
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

/** Geração diária dos últimos `daysBack` dias, indicando se cada valor é medido ou estimado. */
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

    if (histRes.error) console.error("Erro ao buscar inverter_daily_history:", histRes.error);
    if (genRes.error) console.error("Erro ao buscar daily_generation:", genRes.error);

    return mergeDailyGeneration(genRes.data ?? [], histRes.data ?? []);
  } catch (err) {
    console.error("Erro ao buscar geração diária:", err);
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
    console.error("Erro ao calcular geração mensal:", err);
    return [];
  }
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * Monta o histórico plurianual de geração bruta a partir de `inverter_monthly_history`.
 * Os meses a partir de `dailyFromMonth` (YYYY-MM) são somados dos dados diários, pois o
 * último mês importado na tabela mensal pode estar incompleto e os seguintes não existem nela.
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

  const availableYears = Object.keys(yearMonthMap).sort((a, b) => b.localeCompare(a)); // mais recente primeiro

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
      console.error("Erro ao obter inverter_monthly_history:", monthlyRes.error);
    }
    const monthlyRows = monthlyRes.data ?? [];

    const dailyFromMonth = monthlyRows[monthlyRows.length - 1]?.month ?? todayIso.slice(0, 7);
    const daysSince = Math.ceil(
      (Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${dailyFromMonth}-01T00:00:00Z`)) / (24 * 60 * 60 * 1000),
    );
    const dailyEntries = await getGenerationByDay(daysSince + 1);

    return buildMultiYearHistory(monthlyRows, dailyEntries, dailyFromMonth, todayIso);
  } catch (err) {
    console.error("Erro ao obter histórico plurianual:", err);
    return { last12Months: [], yearsTotals: [], byYear: {}, availableYears: [] };
  }
}

export async function getYearlyGeneration(): Promise<GenerationPoint[]> {
  const multi = await getMultiYearHistory();
  return multi.last12Months;
}

/** Clima diário armazenado a partir de `startIso` (inclusive), em ordem cronológica. */
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
    console.error("Erro ao ler daily_weather:", error);
    return [];
  }
  return (data ?? []) as DailyWeatherRow[];
}

/** Grava (upsert por data) dias de clima vindos da Open-Meteo. */
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
  if (error) console.error("Erro ao salvar daily_weather:", error);
}
