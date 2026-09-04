import { supabase } from "@/lib/supabase";
import type { SolarTelemetryRow, UtilityDataRow, SunCurvePoint, GenerationPoint } from "@/lib/types";
import {
  mockSolarTelemetry,
  mockUtilityData,
  mockTodaySunCurve,
  mockMonthlyGeneration,
  mockYearlyGeneration,
} from "@/lib/mockData";

export const GENERATOR_UC = "1000000001";

// ============================================================================
// 🎛️ CONTROLE DE DADOS: MOCK vs BANCO DE PRODUÇÃO (SUPABASE)
// ============================================================================
// Alterne para false quando os coletores locais estiverem conectados e ativos.
// true  = Usa dados simulados realistas de dia de sol pleno (com pico > 100%).
// false = Consulta em tempo real o banco Supabase PostgreSQL.
// ============================================================================
export const USE_MOCK = true;

export async function getLatestTelemetry(): Promise<SolarTelemetryRow | null> {
  if (USE_MOCK) {
    return mockSolarTelemetry;
  }

  // --- Consulta Original Supabase ---
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
  if (USE_MOCK) {
    // mockUtilityData é um snapshot de dados REAIS (não sintéticos) capturados por
    // collector_utility.py em 31/08/2026 — ver comentário em mockData.ts.
    // TODO: com o coletor da Cooperaliança rodando via run_utility.bat de forma
    // recorrente, trocar USE_MOCK para false aqui e a leitura passa a ser sempre
    // a linha mais recente de public.utility_data no Supabase.
    return mockUtilityData;
  }

  // --- Consulta Original Supabase ---
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
  }

  return data;
}

export async function getTodaySunCurve(): Promise<SunCurvePoint[]> {
  if (USE_MOCK) {
    return mockTodaySunCurve;
  }

  // --- Consulta no Supabase para montar a curva do dia ---
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("solar_telemetry")
      .select("recorded_at, total_power_kw, inverters_data")
      .gte("recorded_at", todayStart.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(200);

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((row: any) => {
      const time = new Date(row.recorded_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const invs = row.inverters_data || [];
      const solis = invs.find((i: any) => i.id === "inv_1")?.power_w || 0;
      const gw1 = invs.find((i: any) => i.id === "inv_2")?.power_w || 0;
      const gw2 = invs.find((i: any) => i.id === "inv_3")?.power_w || 0;

      return {
        time,
        power_kw: Number((row.total_power_kw || 0).toFixed(2)),
        nominal_cap_kw: 16.0,
        solis_kw: Number((solis / 1000).toFixed(2)),
        goodwe1_kw: Number((gw1 / 1000).toFixed(2)),
        goodwe2_kw: Number((gw2 / 1000).toFixed(2)),
      };
    });
  } catch (err) {
    console.error("Erro ao buscar curva diária do Supabase:", err);
    return [];
  }
}

export async function getMonthlyGeneration(): Promise<GenerationPoint[]> {
  if (USE_MOCK) {
    return mockMonthlyGeneration;
  }

  // TODO: ainda não implementado no Supabase — requer agregação de solar_telemetry
  // por dia (SUM/último total_today_kwh de cada dia, agrupado por date_trunc('day', recorded_at))
  // acumulada ao longo do mês corrente. Só faz sentido quando o coletor tiver
  // rodado continuamente por semanas/meses para termos histórico suficiente.
  return [];
}

export async function getYearlyGeneration(): Promise<GenerationPoint[]> {
  if (USE_MOCK) {
    return mockYearlyGeneration;
  }

  // TODO: mesma observação de getMonthlyGeneration(), mas agregando por mês
  // (date_trunc('month', recorded_at)) ao longo dos últimos 12 meses.
  return [];
}
