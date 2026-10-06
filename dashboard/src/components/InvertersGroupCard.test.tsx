import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvertersGroupCard } from "./InvertersGroupCard";
import type { InverterReading } from "@/lib/types";
import telemetryFixture from "@/test/fixtures/telemetry-day.json";

describe("InvertersGroupCard", () => {
  const inverters = telemetryFixture[0].inverters_data as unknown as InverterReading[];

  it("renders consolidated header with total online inverters and power", () => {
    render(<InvertersGroupCard inverters={inverters} />);

    expect(screen.getByText("Parque de Inversores")).toBeInTheDocument();
    expect(screen.getByText(/3 de 3 online/i)).toBeInTheDocument();
    expect(screen.getByText(/Potência combinada:/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver strings PV & histórico/i })).toHaveAttribute("href", "/placas");
  });

  it("renders individual cards for each inverter in the plant", () => {
    render(<InvertersGroupCard inverters={inverters} />);

    expect(screen.getByText("Inversor 1 (Solis 6kW)")).toBeInTheDocument();
    expect(screen.getByText("Inversor 2 (GoodWe 5kW - Inv 19)")).toBeInTheDocument();
    expect(screen.getByText("Inversor 3 (GoodWe 5kW - Inv 20)")).toBeInTheDocument();

    const activeIndicators = screen.getAllByText("Ativo");
    expect(activeIndicators.length).toBe(3);
  });

  it("displays quick metrics for temperature, voltage, and energy generated today", () => {
    render(<InvertersGroupCard inverters={inverters} />);

    expect(screen.getAllByText(/kWh/).length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText(/V/).length).toBeGreaterThanOrEqual(3);
  });

  it("handles offline inverters and zero power without divide-by-zero errors", () => {
    const offlineInverters: InverterReading[] = inverters.map((inv) => ({
      ...inv,
      status: "offline",
      power_w: 0,
    }));

    render(<InvertersGroupCard inverters={offlineInverters} />);
    expect(screen.getByText(/0 de 3 online/i)).toBeInTheDocument();
    const standbyBadges = screen.getAllByText("Standby");
    expect(standbyBadges.length).toBe(3);
  });
});
