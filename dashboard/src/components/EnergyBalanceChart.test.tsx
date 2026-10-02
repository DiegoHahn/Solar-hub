import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnergyBalanceChart } from "./EnergyBalanceChart";
import { findGeneratorUcCode } from "@/lib/utility";
import { normalizeUnidadeConsumidora } from "@/lib/queries";
import utilityFixture from "@/test/fixtures/utility-data.json";
import type { UnidadeConsumidora } from "@/lib/types";

describe("EnergyBalanceChart", () => {
  const genCode = findGeneratorUcCode(utilityFixture.unidades_consumidoras as Record<string, UnidadeConsumidora>)!;
  const normalized = normalizeUnidadeConsumidora({
    ...utilityFixture.unidades_consumidoras[genCode as keyof typeof utilityFixture.unidades_consumidoras],
  } as unknown as UnidadeConsumidora);
  const balanco = normalized.balanco_energetico!;

  it("não renderiza nada se os dados forem vazios", () => {
    const { container } = render(<EnergyBalanceChart data={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza o cabeçalho, KPIs consolidados e abas de alternância", () => {
    render(<EnergyBalanceChart data={balanco} />);

    expect(screen.getByRole("heading", { name: /Balanço Energético/i })).toBeInTheDocument();
    expect(screen.getByText("Últimos 12 meses faturados (Cooperaliança)")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Injeção vs Rede" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Líquido (±)" })).toBeInTheDocument();
  });

  it("permite alternar entre as abas 'Injeção vs Rede' e 'Líquido (±)'", () => {
    render(<EnergyBalanceChart data={balanco} />);

    const netTab = screen.getByRole("button", { name: "Líquido (±)" });
    fireEvent.click(netTab);
    expect(netTab).toHaveClass("bg-white");

    const comparisonTab = screen.getByRole("button", { name: "Injeção vs Rede" });
    fireEvent.click(comparisonTab);
    expect(comparisonTab).toHaveClass("bg-white");
  });

  it("exibe o saldoAtual informado no cabeçalho e rodapé prioritariamente", () => {
    render(<EnergyBalanceChart data={balanco} saldoAtual={9900} />);
    expect(screen.getByText("9.900")).toBeInTheDocument();
    expect(screen.getByText("Saldo atual: 9.900 kWh")).toBeInTheDocument();
  });

  it("remove mês não faturado zerado do final do array de dados", () => {
    const dataWithTrailingZero = [
      { mes: "08/2026", injetado_kwh: 1400, compensado_kwh: 600, liquido_kwh: 800, saldo_kwh: 9000 },
      { mes: "09/2026", injetado_kwh: 1450, compensado_kwh: 550, liquido_kwh: 900, saldo_kwh: 9900 },
      { mes: "10/2026", injetado_kwh: 0, compensado_kwh: 0, liquido_kwh: 0, saldo_kwh: 0 },
    ];
    render(<EnergyBalanceChart data={dataWithTrailingZero} />);
    // O último saldo exibido deve ser o de 09/2026 (9.900) e não 0
    expect(screen.getByText("9.900")).toBeInTheDocument();
    expect(screen.getByText("Saldo atual: 9.900 kWh")).toBeInTheDocument();
  });
});
