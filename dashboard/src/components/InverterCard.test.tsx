import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InverterCard } from "./InverterCard";
import type { InverterReading } from "@/lib/types";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";

describe("InverterCard", () => {
  const realInverter = telemetryDayFixture[0].inverters_data[0] as unknown as InverterReading;

  it("renderiza o nome do inversor, status online e potência", () => {
    render(<InverterCard inverter={realInverter} />);

    expect(screen.getByText(realInverter.name)).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText(realInverter.power_w.toLocaleString("pt-BR"))).toBeInTheDocument();
  });

  it("calcula e exibe a porcentagem da capacidade nominal", () => {
    render(<InverterCard inverter={realInverter} />);
    expect(screen.getByText(/% de \d+ kW/)).toBeInTheDocument();
  });

  it("exibe badge Standby e potência zero quando desconectado", () => {
    const offlineInverter: InverterReading = {
      ...realInverter,
      status: "offline",
      power_w: 0,
    };

    render(<InverterCard inverter={offlineInverter} />);
    expect(screen.getByText("Standby")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("alterna diagnóstico avançado no modo não controlado (estado interno)", () => {
    render(<InverterCard inverter={realInverter} detailed />);

    expect(screen.getByText("Expandir")).toBeInTheDocument();
    expect(screen.queryByText("Sensores Térmicos")).not.toBeInTheDocument();

    const toggleButton = screen.getByRole("button", { name: /Diagnóstico/ });
    fireEvent.click(toggleButton);

    expect(screen.getByText("Ocultar")).toBeInTheDocument();
    expect(screen.getByText("Sensores Térmicos")).toBeInTheDocument();
  });

  it("respeita a prop controlada showAdvanced e chama onToggleAdvanced", () => {
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
