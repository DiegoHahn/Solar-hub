import type { UnidadeConsumidora, UtilityDataRow } from "@/lib/types";
import type { BadgeProps } from "@/components/Badge";
import type { Translations } from "@/i18n/types";

/**
 * Identifies the generator Consumer Unit (where the solar plant is installed) among the account units:
 * the unit with installed GD capacity, or falling back to the unit with energy injection records.
 */
export function findGeneratorUcCode(consumerUnits: Record<string, UnidadeConsumidora> | undefined): string | null {
  const entries = Object.entries(consumerUnits ?? {});

  const byPower = entries.find(([, uc]) => (uc.geracao_distribuida?.PotenciaInstalada ?? 0) > 0);
  if (byPower) return byPower[0];

  const byInjection = entries.find(([, uc]) =>
    uc.extrato_historico_gd?.RetornoDadosHistoricoGeracaoKwhNormal?.some((e) =>
      (e.Operacao || "").includes("Energia injetada"),
    ),
  );
  return byInjection ? byInjection[0] : null;
}

/** Generator Consumer Unit already resolved in `getLatestUtilityData`. */
export function getGeneratorUc(utilityData: UtilityDataRow | null | undefined): UnidadeConsumidora | undefined {
  const code = utilityData?.generator_uc;
  return code ? utilityData.unidades_consumidoras[code] : undefined;
}

/** Masks Consumer Unit code leaving only the last 4 digits visible (e.g., "••••1234"). */
export function maskUcCode(code: string | null | undefined): string {
  if (!code) return "—";
  return code.length > 4 ? `••••${code.slice(-4)}` : code;
}

/** Badge color for the tariff flag reported by the utility ("Bandeira verde", "Bandeira amarela", ...). */
export function tariffFlagVariant(flag: string | undefined): BadgeProps["variant"] {
  const f = (flag ?? "").toLowerCase();
  if (f.includes("verde")) return "success";
  if (f.includes("amarela")) return "warning";
  if (f.includes("vermelha")) return "error";
  return "neutral";
}

/** Tariff flag label in the current language; unknown flags are shown as reported. */
export function translateTariffFlag(flag: string | undefined, t: Translations): string {
  if (!flag) return "";
  const f = flag.toLowerCase();
  if (f.includes("verde")) return t.utility.flagGreen;
  if (f.includes("amarela")) return t.utility.flagYellow;
  if (f.includes("vermelha")) return t.utility.flagRed;
  if (f.includes("escassez")) return t.utility.flagWaterScarcity;
  return flag;
}

/** Account holder first name, capitalized for UI display. */
export function holderFirstName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
}
