import { createClient } from "@/lib/supabase/server";
import type { UtilityDataRow, UnidadeConsumidora } from "@/lib/types";
import { findGeneratorUcCode } from "@/lib/utility";

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

  // When the portal returns no balance, it is taken from the GD statement or the 12-month chart;
  // values missing from every source stay undefined and are shown as unavailable.
  const gd = uc.geracao_distribuida;
  if (!gd || Object.keys(gd).length === 0 || gd.ValorProximoSaldoVencer == null) {
    const histItems = hist12 || [];
    const fallbackBalance = gdStatement?.[0]?.Saldo ?? histItems[histItems.length - 1]?.Saldo;

    uc.geracao_distribuida = {
      ...gd,
      ValorProximoSaldoVencer: gd?.ValorProximoSaldoVencer ?? fallbackBalance,
      ProximoSaldoVencer: gd?.ProximoSaldoVencer ? gd.ProximoSaldoVencer.split(" ")[0] : undefined,
      PotenciaInstalada: gd?.PotenciaInstalada || undefined,
      PercentualFatUcGeradora: gd?.PercentualFatUcGeradora || undefined,
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
