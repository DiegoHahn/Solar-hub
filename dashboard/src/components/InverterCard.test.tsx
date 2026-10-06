import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InverterCard } from "./InverterCard";
import type { InverterReading } from "@/lib/types";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";

describe("InverterCard", () => {
  const realInverter = telemetryDayFixture[0].inverters_data[0] as unknown as InverterReading;

  it("renders inverter name, online status, and power output", () => {
    render(<InverterCard inverter={realInverter} />);

    expect(screen.getByText(realInverter.name)).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText(realInverter.power_w.toLocaleString("pt-BR"))).toBeInTheDocument();
  });

  it("calculates and displays percentage of nominal capacity", () => {
    render(<InverterCard inverter={realInverter} />);
    expect(screen.getByText(/% de \d+ kW/)).toBeInTheDocument();
  });

  it("displays Standby badge and zero power when disconnected", () => {
    const offlineInverter: InverterReading = {
      ...realInverter,
      status: "offline",
      power_w: 0,
    };

    render(<InverterCard inverter={offlineInverter} />);
    expect(screen.getByText("Standby")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("toggles advanced diagnostics in uncontrolled mode (internal state)", () => {
    render(<InverterCard inverter={realInverter} detailed />);

    expect(screen.getByText("Expandir")).toBeInTheDocument();
    expect(screen.queryByText("Sensores Térmicos")).not.toBeInTheDocument();

    const toggleButton = screen.getByRole("button", { name: /Diagnóstico/ });
    fireEvent.click(toggleButton);

    expect(screen.getByText("Ocultar")).toBeInTheDocument();
    expect(screen.getByText("Sensores Térmicos")).toBeInTheDocument();
  });

  it("respects controlled showAdvanced prop and calls onToggleAdvanced", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <InverterCard
        inverter={realInverter}
        detailed
        showAdvanced={false}
        onToggleAdvanced={onToggle}
      />,
    );

    expect(screen.queryByText("Sensores Térmicos")).not.toBeInTheDocument();

    const toggleButton = screen.getByRole("button", { name: /Diagnóstico/ });
    fireEvent.click(toggleButton);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <InverterCard
        inverter={realInverter}
        detailed
        showAdvanced={true}
        onToggleAdvanced={onToggle}
      />,
    );
    expect(screen.getByText("Sensores Térmicos")).toBeInTheDocument();
  });
});
