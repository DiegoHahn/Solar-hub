import type { InverterReading } from "@/lib/types";

/** Potência nominal do inversor em kW (Solis 6 kW; GoodWe 5 kW), salvo quando informada explicitamente. */
export function getNominalKw(inverter: InverterReading): number {
  if (inverter.nominal_kw) return inverter.nominal_kw;
  if (inverter.id === "inv_1" || inverter.brand?.toLowerCase().includes("solis")) {
    return 6.0;
  }
  return 5.0;
}

/**
 * Lê um sensor numérico de `raw_sensors`. O coletor serializa como string os valores que a lib
 * GoodWe não entrega como número, então aceita strings numéricas e descarta o resto.
 */
export function readNumericSensor(inverter: InverterReading, key: string): number | null {
  const value = inverter.raw_sensors?.[key];
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
