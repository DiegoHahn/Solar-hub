import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnergyBalanceChart } from "./EnergyBalanceChart";
import { findGeneratorUcCode } from "@/lib/utility";
import { normalizeUnidadeConsumidora } from "@/lib/queries";
import utilityFixture from "@/test/fixtures/utility-data.json";
import type { UnidadeConsumidora } from "@/lib/types";

import { ptBR } from "@/i18n/locales/pt-BR";

describe("EnergyBalanceChart", () => {
  const genCode = findGeneratorUcCode(utilityFixture.unidades_consumidoras as Record<string, UnidadeConsumidora>)!;
  const normalized = normalizeUnidadeConsumidora({
    ...utilityFixture.unidades_consumidoras[genCode as keyof typeof utilityFixture.unidades_consumidoras],
  } as unknown as UnidadeConsumidora);
  const balanco = normalized.balanco_energetico!;

  it("renders nothing if data array is empty", () => {
    const { container } = render(<EnergyBalanceChart data={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders header, consolidated KPIs, and toggle tabs", () => {
    render(<EnergyBalanceChart data={balanco} />);

    expect(screen.getByRole("heading", { name: new RegExp(ptBR.utility.energyBalanceTitle, "i") })).toBeInTheDocument();
    expect(screen.getByText(ptBR.utility.last12BilledMonths)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: ptBR.utility.injectionVsGrid })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ptBR.utility.netTab })).toBeInTheDocument();
  });

  it("allows toggling between 'Injeção vs Rede' and 'Líquido (±)' tabs", () => {
    render(<EnergyBalanceChart data={balanco} />);

    const netTab = screen.getByRole("button", { name: ptBR.utility.netTab });
    fireEvent.click(netTab);
    expect(netTab).toHaveClass("bg-white");

    const comparisonTab = screen.getByRole("button", { name: ptBR.utility.injectionVsGrid });
    fireEvent.click(comparisonTab);
    expect(comparisonTab).toHaveClass("bg-white");
  });

  it("displays provided saldoAtual in header and footer with priority", () => {
    render(<EnergyBalanceChart data={balanco} saldoAtual={9900} />);
    expect(screen.getByText("9.900")).toBeInTheDocument();
    expect(screen.getByText("Saldo atual: 9.900 kWh")).toBeInTheDocument();
  });

  it("removes trailing unbilled zeroed month from end of data array", () => {
    const dataWithTrailingZero = [
      { mes: "08/2026", injetado_kwh: 1400, compensado_kwh: 600, liquido_kwh: 800, saldo_kwh: 9000 },
      { mes: "09/2026", injetado_kwh: 1450, compensado_kwh: 550, liquido_kwh: 900, saldo_kwh: 9900 },
      { mes: "10/2026", injetado_kwh: 0, compensado_kwh: 0, liquido_kwh: 0, saldo_kwh: 0 },
    ];
    render(<EnergyBalanceChart data={dataWithTrailingZero} />);
    // The last displayed balance must be 09/2026 (9,900) and not 0
    expect(screen.getByText("9.900")).toBeInTheDocument();
    expect(screen.getByText("Saldo atual: 9.900 kWh")).toBeInTheDocument();
  });
});
