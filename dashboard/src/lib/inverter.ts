import type { InverterReading } from "@/lib/types";

/** Inverter nominal capacity in kW (Solis 6 kW; GoodWe 5 kW), unless explicitly provided. */
export function getNominalKw(inverter: InverterReading): number {
  if (inverter.nominal_kw) return inverter.nominal_kw;
  if (inverter.id === "inv_1" || inverter.brand?.toLowerCase().includes("solis")) {
    return 6.0;
  }
  return 5.0;
}

/**
 * Reads a numeric sensor from `raw_sensors`. The collector serializes non-numeric GoodWe values
 * as strings, so numeric strings are parsed and non-finite values are discarded.
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

/**
 * AC output as a percentage of the DC input, rounded to one decimal. Returns null without DC input, or when
 * the readings are inconsistent (AC above DC), since string power is derived from voltage and current
 * and the AC reading comes from a different register.
 */
export function conversionEfficiencyPct(acW: number, dcW: number): number | null {
  if (dcW <= 0) return null;
  const pct = Math.round((acW / dcW) * 1000) / 10;
  return pct > 100 ? null : pct;
}
