import { describe, expect, it } from "vitest";
import type { InverterReading } from "./types";
import { getNominalKw, readNumericSensor } from "./inverter";

const inverter = (overrides: Partial<InverterReading> = {}): InverterReading => ({
  id: "inv_2",
  name: "GoodWe 1",
  brand: "GoodWe",
  ip: "10.0.0.20",
  status: "online",
  power_w: 3200,
  energy_today_kwh: 12.5,
  energy_total_kwh: 8000,
  ...overrides,
});

describe("getNominalKw", () => {
  it("prioritizes explicit nominal_kw", () => {
    expect(getNominalKw(inverter({ nominal_kw: 8 }))).toBe(8);
  });

  it("assumes 6 kW for Solis (inv_1 or Solis brand)", () => {
    expect(getNominalKw(inverter({ id: "inv_1" }))).toBe(6);
    expect(getNominalKw(inverter({ id: "x", brand: "Solis / Ginlong" }))).toBe(6);
  });

  it("assumes 5 kW for other inverters (GoodWe)", () => {
    expect(getNominalKw(inverter())).toBe(5);
  });
});

describe("readNumericSensor", () => {
  it("returns numbers directly", () => {
    expect(readNumericSensor(inverter({ raw_sensors: { power_factor: 0.998 } }), "power_factor")).toBe(0.998);
  });

  it("converts numeric strings serialized by the collector", () => {
    expect(readNumericSensor(inverter({ raw_sensors: { vbus: "385.2" } }), "vbus")).toBe(385.2);
  });

  it("returns null for missing, boolean, non-numeric, and empty strings", () => {
    const inv = inverter({ raw_sensors: { flag: true, mode: "Normal", empty: " " } });
    expect(readNumericSensor(inv, "missing")).toBeNull();
    expect(readNumericSensor(inv, "flag")).toBeNull();
    expect(readNumericSensor(inv, "mode")).toBeNull();
    expect(readNumericSensor(inv, "empty")).toBeNull();
    expect(readNumericSensor(inverter(), "vbus")).toBeNull();
  });
});
