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
});
