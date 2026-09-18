import { supabase } from "@/lib/supabase";
import type { SolarTelemetryRow, UtilityDataRow, SunCurvePoint, GenerationPoint } from "@/lib/types";

export const GENERATOR_UC = "1000000001";

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

    return data.map((row: any) => {
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

export async function getTelemetryByDay(daysBack: number = 90): Promise<Record<string, number>> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("solar_telemetry")
      .select("recorded_at, total_today_kwh")
      .gte("recorded_at", startDate.toISOString())
      .order("recorded_at", { ascending: true });

    if (error || !data || data.length === 0) {
      return {};
    }

    const byDay: Record<string, number> = {};
    for (const r of data) {
      const dayIso = new Date(r.recorded_at).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).split("/").reverse().join("-");

      const val = Number(r.total_today_kwh) || 0;
      if (!byDay[dayIso] || val > byDay[dayIso]) {
        byDay[dayIso] = val;
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

export async function getYearlyGeneration(): Promise<GenerationPoint[]> {
  try {
    const utility = await getLatestUtilityData();
    const uc = utility?.unidades_consumidoras?.[GENERATOR_UC] as any;
    const hist = uc?.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal || [];

    if (hist.length > 0) {
      return hist.map((i: any) => {
        const parts = (i.AnoMes || "").split(" ")[0].split("/");
        const mes = parts[1] || "";
        const ano = (parts[2] || "").slice(-2);
        return {
          label: `${mes}/${ano}`,
          kwh: Number(i.KwhGerado) || 0,
        };
      });
    }
    return [];
  } catch (err) {
    console.error("Erro ao obter geração anual:", err);
    return [];
  }
}

