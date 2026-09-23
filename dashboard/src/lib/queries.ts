import { supabase } from "@/lib/supabase";
import type {
  SolarTelemetryRow,
  UtilityDataRow,
  SunCurvePoint,
  GenerationPoint,
  MultiYearHistory,
} from "@/lib/types";

import { GENERATOR_UC } from "@/lib/constants";
export { GENERATOR_UC };

export async function getLatestTelemetry(): Promise<SolarTelemetryRow | null> {
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
  const { data, error } = await supabase
    .from("utility_data")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (data?.unidades_consumidoras?.[GENERATOR_UC]) {
    const uc = data.unidades_consumidoras[GENERATOR_UC] as any;
    if (!uc.balanco_energetico && uc.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal) {
      uc.balanco_energetico = uc.grafico_historico_12_meses.RetornoDadosHistoricoGeracaoConsumoKwhNormal.map((i: any) => {
        const parts = i.AnoMes.split(" ")[0].split("/");
        return {
          mes: `${parts[1]}/${parts[2]}`,
          injetado_kwh: i.KwhGerado,
          compensado_kwh: i.kwhCreditado,
          liquido_kwh: i.KwhGerado - i.kwhCreditado,
          saldo_kwh: i.Saldo,
        };
      });
    }
    if (!uc.extrato_gd && uc.extrato_historico_gd?.RetornoDadosHistoricoGeracaoKwhNormal) {
      uc.extrato_gd = uc.extrato_historico_gd.RetornoDadosHistoricoGeracaoKwhNormal.map((e: any) => {
        const isInjetada = (e.Operacao || "").includes("Energia injetada");
        const rawDate = e.MesGeracao?.startsWith("01/01/0001") ? e.MesFaturamento : e.MesGeracao;
        const parts = (rawDate || e.MesFaturamento || "").split(" ")[0].split("/");
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
    if (!uc.geracao_distribuida || Object.keys(uc.geracao_distribuida).length === 0 || !uc.geracao_distribuida.ValorProximoSaldoVencer) {
      // Extrai o saldo mais recente do extrato_gd ou do grafico de 12 meses
      const extratoItems = uc.extrato_historico_gd?.RetornoDadosHistoricoGeracaoKwhNormal || [];
      const histItems = uc.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal || [];
      const fallbackSaldo = extratoItems[0]?.Saldo ?? histItems[histItems.length - 1]?.Saldo ?? 9900;

      uc.geracao_distribuida = {
        ...uc.geracao_distribuida,
        ValorProximoSaldoVencer: uc.geracao_distribuida?.ValorProximoSaldoVencer || fallbackSaldo,
        ProximoSaldoVencer: uc.geracao_distribuida?.ProximoSaldoVencer || "Próx. ciclo",
        PotenciaInstalada: uc.geracao_distribuida?.PotenciaInstalada || 16.0,
        PercentualFatUcGeradora: uc.geracao_distribuida?.PercentualFatUcGeradora || 100,
      };
    }

    // Normaliza resumo_ultima_fatura caso o endpoint do portal venha vazio
    if (!uc.resumo_ultima_fatura || Object.keys(uc.resumo_ultima_fatura).length === 0 || uc.resumo_ultima_fatura.ValorFatura === undefined) {
      const faturas = uc.historico_faturas_60_meses || [];
      const lastFatura = faturas[faturas.length - 1];
      if (lastFatura) {
        const anoMesParts = (lastFatura.AnoMes || "").split(" ")[0].split("/");
        uc.resumo_ultima_fatura = {
          ValorFatura: lastFatura.ValorTotal ?? 0,
          KwhReal: lastFatura.ConsumoFaturado ?? 0,
          AnoMes: anoMesParts.length >= 3 ? `${anoMesParts[1]}/${anoMesParts[2]}` : "09/2026",
          DataLProxima: lastFatura.Vcto ? lastFatura.Vcto.split(" ")[0] : "—",
        };
      }
    }
  }

  return data;
}

export async function getTodaySunCurve(): Promise<SunCurvePoint[]> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("solar_telemetry")
      .select("recorded_at, total_power_kw, inverters_data")
      .gte("recorded_at", todayStart.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(300);

    if (error || !data || data.length === 0) {
      return [];
    }

    const rawPoints: SunCurvePoint[] = (data || []).map((row: any) => {
      const time = new Date(row.recorded_at).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      });
      const invs = row.inverters_data || [];
      const solis = invs.find((i: any) => i.id === "inv_1")?.power_w || 0;
      const gw1 = invs.find((i: any) => i.id === "inv_2")?.power_w || 0;
      const gw2 = invs.find((i: any) => i.id === "inv_3")?.power_w || 0;
      return {
        time,
        timestamp: new Date(row.recorded_at).getTime(),
        power_kw: Number((row.total_power_kw || 0).toFixed(2)),
        nominal_cap_kw: 16.0,
        solis_kw: Number((solis / 1000).toFixed(2)),
        goodwe1_kw: Number((gw1 / 1000).toFixed(2)),
        goodwe2_kw: Number((gw2 / 1000).toFixed(2)),
      } as any;
    });

    // Monta a grade contínua de 30 em 30 minutos desde 00:00 até o momento atual do dia
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const now = new Date();

    const grid: SunCurvePoint[] = [];
    const currentSlot = new Date(startOfDay);

    while (currentSlot <= now) {
      const slotTimeMs = currentSlot.getTime();
      const timeStr = currentSlot.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Busca a telemetria física real coletada mais próxima desse slot (dentro de uma janela de 20 min)
      const closest = rawPoints.reduce(
        (best: { point: any; diff: number } | null, p: any) => {
          const diff = Math.abs(p.timestamp - slotTimeMs);
          if (!best || diff < best.diff) return { point: p, diff };
          return best;
        },
        null
      );

      const matchedPoint = closest && closest.diff <= 20 * 60 * 1000 ? closest.point : null;

      grid.push({
        time: timeStr,
        power_kw: matchedPoint ? matchedPoint.power_kw : 0,
        nominal_cap_kw: 16.0,
        solis_kw: matchedPoint ? matchedPoint.solis_kw : 0,
        goodwe1_kw: matchedPoint ? matchedPoint.goodwe1_kw : 0,
        goodwe2_kw: matchedPoint ? matchedPoint.goodwe2_kw : 0,
      });

      currentSlot.setMinutes(currentSlot.getMinutes() + 30);
    }

    return grid.length > 0 ? grid : rawPoints;
  } catch (err) {
    console.error("Erro ao buscar curva diária do Supabase:", err);
    return [];
  }
}

export async function getTelemetryByDay(daysBack: number = 90): Promise<Record<string, number>> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);
    const startIso = startDate.toISOString().split("T")[0];

    // Busca tanto o histórico consolidado quanto as telemetrias reais em paralelo
    const [histRes, teleRes] = await Promise.all([
      supabase
        .from("inverter_daily_history")
        .select("date, kwh, inverter_id")
        .gte("date", startIso)
        .in("inverter_id", ["plant_total", "goodwe_combined", "inv_1"])
        .order("date", { ascending: true }),
      supabase
        .from("solar_telemetry")
        .select("recorded_at, total_today_kwh")
        .gte("recorded_at", startDate.toISOString())
        .order("recorded_at", { ascending: true }),
    ]);

    const byDay: Record<string, number> = {};

    // 1. Popula primeiro com a telemetria física real coletada a cada 10 min
    if (teleRes.data && teleRes.data.length > 0) {
      for (const r of teleRes.data) {
        const dayIso = new Date(r.recorded_at).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).split("/").reverse().join("-");

        const val = Number(r.total_today_kwh) || 0;
        if (!byDay[dayIso] || val > byDay[dayIso]) {
          byDay[dayIso] = Number(val.toFixed(1));
        }
      }
    }

    // 2. Mescla/Consolida com a tabela oficial de histórico fechado
    if (histRes.data && histRes.data.length > 0) {
      const grouped: Record<string, Record<string, number>> = {};
      for (const r of histRes.data) {
        if (!grouped[r.date]) grouped[r.date] = {};
        grouped[r.date][r.inverter_id] = Number(r.kwh) || 0;
      }

      for (const [date, invs] of Object.entries(grouped)) {
        if (invs["plant_total"] !== undefined) {
          byDay[date] = Number(invs["plant_total"].toFixed(1));
        } else if (invs["goodwe_combined"] !== undefined && invs["inv_1"] !== undefined) {
          byDay[date] = Number((invs["goodwe_combined"] + invs["inv_1"]).toFixed(1));
        } else if (invs["goodwe_combined"] !== undefined) {
          byDay[date] = Number(invs["goodwe_combined"].toFixed(1));
        } else if (invs["inv_1"] !== undefined) {
          byDay[date] = Number(invs["inv_1"].toFixed(1));
        }
      }
    }

    return byDay;
  } catch (err) {
    console.error("Erro ao buscar histórico diário de telemetria:", err);
    return {};
  }
}

export async function getMonthlyGeneration(): Promise<GenerationPoint[]> {
  try {
    const byDay = await getTelemetryByDay(31);
    return Object.entries(byDay).map(([iso, kwh]) => {
      const parts = iso.split("-");
      return {
        label: `${parts[2]}/${parts[1]}`,
        kwh: Number(kwh.toFixed(1)),
      };
    });
  } catch (err) {
    console.error("Erro ao calcular geração mensal:", err);
    return [];
  }
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function getMultiYearHistory(): Promise<MultiYearHistory> {
  const emptyResult: MultiYearHistory = {
    last12Months: [],
    yearsTotals: [],
    byYear: {},
    availableYears: [],
  };

  try {
    const utility = await getLatestUtilityData();
    const uc = utility?.unidades_consumidoras?.[GENERATOR_UC] as any;

    // 1. Obter os 12 meses mais recentes da concessionária (gráfico padrão)
    const hist12 = uc?.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal || [];
    let last12: GenerationPoint[] = [];
    if (hist12.length > 0) {
      last12 = hist12.map((i: any) => {
        const parts = (i.AnoMes || "").split(" ")[0].split("/");
        const mes = parts[1] || "";
        const ano = (parts[2] || "").slice(-2);
        return {
          label: `${mes}/${ano}`,
          kwh: Number(i.KwhGerado) || 0,
        };
      });
    }

    // 2. Extrair histórico completo plurianual a partir do extrato_historico_gd
    const rawGd = uc?.extrato_historico_gd?.RetornoDadosHistoricoGeracaoKwhNormal || [];
    
    // Mapeamento: year -> monthNumber (1..12) -> kwh
    const yearMonthMap: Record<string, Record<number, number>> = {};
    const yearTotalsMap: Record<string, number> = {};

    for (const item of rawGd) {
      const operacao = item.Operacao || "";
      if (!operacao.includes("(C) Energia injetada")) continue;

      const rawDate = item.MesGeracao || "";
      if (!rawDate || rawDate.startsWith("01/01/0001")) continue;

      const datePart = rawDate.split(" ")[0]; // "DD/MM/YYYY"
      const parts = datePart.split("/");
      if (parts.length < 3) continue;

      const month = parseInt(parts[1], 10);
      const year = parts[2];
      const kwh = Number(item.KwhGerado) || 0;

      if (!yearMonthMap[year]) {
        yearMonthMap[year] = {};
        yearTotalsMap[year] = 0;
      }
      yearMonthMap[year][month] = (yearMonthMap[year][month] || 0) + kwh;
      yearTotalsMap[year] = (yearTotalsMap[year] || 0) + kwh;
    }

    const availableYears = Object.keys(yearMonthMap).sort((a, b) => b.localeCompare(a)); // 2026, 2025, 2024...

    // Formatar byYear com os meses de cada ano
    const byYear: Record<string, GenerationPoint[]> = {};
    for (const yr of availableYears) {
      const months = yearMonthMap[yr];
      // Para o ano corrente (2026), vai até o mês de corte; para anos anteriores, até 12 meses
      const maxMonth = yr === "2026" ? 9 : 12;
      const pts: GenerationPoint[] = [];
      for (let m = 1; m <= maxMonth; m++) {
        const val = months[m] || 0;
        pts.push({
          label: MONTH_NAMES[m - 1],
          kwh: Math.round(val),
        });
      }
      byYear[yr] = pts;
    }

    // Formatar yearsTotals em ordem cronológica (2021, 2022, 2023...)
    const yearsTotals: GenerationPoint[] = Object.keys(yearTotalsMap)
      .sort((a, b) => a.localeCompare(b))
      .map((yr) => ({
        label: yr,
        kwh: Math.round(yearTotalsMap[yr]),
      }));

    return {
      last12Months: last12.length > 0 ? last12 : (byYear["2026"] || []),
      yearsTotals,
      byYear,
      availableYears,
    };
  } catch (err) {
    console.error("Erro ao obter histórico plurianual:", err);
    return emptyResult;
  }
}

export async function getYearlyGeneration(): Promise<GenerationPoint[]> {
  const multi = await getMultiYearHistory();
  return multi.last12Months;
}

