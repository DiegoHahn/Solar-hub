import type { UnidadeConsumidora, UtilityDataRow } from "@/lib/types";

/**
 * Identifica a UC geradora (onde a usina está instalada) entre as unidades consumidoras do titular:
 * a que tem potência instalada de GD ou, na falta desse dado, a que tem lançamentos de energia injetada.
 */
export function findGeneratorUcCode(unidades: Record<string, UnidadeConsumidora> | undefined): string | null {
  const entries = Object.entries(unidades ?? {});

  const byPower = entries.find(([, uc]) => (uc.geracao_distribuida?.PotenciaInstalada ?? 0) > 0);
  if (byPower) return byPower[0];

  const byInjection = entries.find(([, uc]) =>
    uc.extrato_historico_gd?.RetornoDadosHistoricoGeracaoKwhNormal?.some((e) =>
      (e.Operacao || "").includes("Energia injetada"),
    ),
  );
  return byInjection ? byInjection[0] : null;
}

/** Unidade consumidora geradora já resolvida em `getLatestUtilityData`. */
export function getGeneratorUc(utilityData: UtilityDataRow | null | undefined): UnidadeConsumidora | undefined {
  const code = utilityData?.generator_uc;
  return code ? utilityData.unidades_consumidoras[code] : undefined;
}
