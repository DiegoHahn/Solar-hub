import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatCard } from "./StatCard";
import { EnergyFlowSection } from "./EnergyFlowSection";
import { GdExtractList } from "./GdExtractList";
import { ConsumptionHistoryChart } from "./ConsumptionHistoryChart";
import { RiSunLine, RiWallet3Line } from "@remixicon/react";
import { findGeneratorUcCode } from "@/lib/utility";
import { normalizeUnidadeConsumidora } from "@/lib/queries";
import utilityFixture from "../test/fixtures/utility-data.json";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";
import type { UtilityDataRow, SolarTelemetryRow, UnidadeConsumidora, HistoricoConsumoMes } from "@/lib/types";

describe("Componentes de Cooperativa", () => {
  const genCode = findGeneratorUcCode(utilityFixture.unidades_consumidoras as Record<string, UnidadeConsumidora>)!;
  const normalizedUc = normalizeUnidadeConsumidora({
    ...utilityFixture.unidades_consumidoras[genCode as keyof typeof utilityFixture.unidades_consumidoras],
  } as unknown as UnidadeConsumidora);

  const utilityData: UtilityDataRow = {
    ...(utilityFixture as unknown as UtilityDataRow),
    generator_uc: genCode,
    unidades_consumidoras: {
      ...utilityFixture.unidades_consumidoras,
      [genCode]: normalizedUc,
    } as unknown as Record<string, UnidadeConsumidora>,
  };

  const telemetry = telemetryDayFixture[0] as unknown as SolarTelemetryRow;

  describe("StatCard", () => {
    it("renderiza label, valor, unidade e dica", () => {
      render(
        <StatCard
          label="Economia Mensal"
          value="R$ 1.250,00"
          unit="/mês"
          hint="Estimativa baseada na tarifa"
          icon={RiWallet3Line}
          accent="emerald"
        />,
      );

      expect(screen.getByText("Economia Mensal")).toBeInTheDocument();
      expect(screen.getByText("R$ 1.250,00")).toBeInTheDocument();
      expect(screen.getByText("/mês")).toBeInTheDocument();
      expect(screen.getByText("Estimativa baseada na tarifa")).toBeInTheDocument();
    });

    it("aplica estilo esmaecido quando dim é verdadeiro", () => {
      const { container } = render(
        <StatCard
          label="Offline"
          value="0"
          icon={RiSunLine}
          dim
        />,
      );

      expect(screen.getByText("Offline")).toBeInTheDocument();
      expect(container.querySelector(".bg-gray-800\\/60")).toBeInTheDocument();
    });
  });

  describe("EnergyFlowSection", () => {
    it("renderiza o cabeçalho e métricas do fluxo de hoje por padrão", () => {
      render(<EnergyFlowSection telemetry={telemetry} utilityData={utilityData} monthSolarKwh={850} />);

      expect(screen.getByText("Fluxo de Energia Real")).toBeInTheDocument();
      expect(screen.getByText("Placas + Cooperativa")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Hoje" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mês Atual" })).toBeInTheDocument();

      const kwhHoje = telemetry.total_today_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
      expect(screen.getByText(kwhHoje)).toBeInTheDocument();
    });

    it("permite alternar para a visão de mês atual", () => {
      render(<EnergyFlowSection telemetry={telemetry} utilityData={utilityData} monthSolarKwh={850} />);

      fireEvent.click(screen.getByRole("button", { name: "Mês Atual" }));

      expect(screen.getByText("Geração total do período")).toBeInTheDocument();
    });
  });

  describe("GdExtractList", () => {
    const entries = normalizedUc.extrato_gd || [];

    it("renderiza a lista de lançamentos de extrato com dados da fixture", () => {
      render(<GdExtractList entries={entries} />);

      expect(screen.getByText("Extrato de Geração Distribuída")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Filtrar por mês/i)).toBeInTheDocument();

      expect(screen.getByRole("button", { name: /Todos/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Injetada/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Compensada/i })).toBeInTheDocument();
    });

    it("filtra por tipo ao clicar no botão Injetada e Compensada", () => {
      render(<GdExtractList entries={entries} />);

      fireEvent.click(screen.getByRole("button", { name: /Injetada/i }));
      const injetadaItems = screen.getAllByText("Energia injetada");
      expect(injetadaItems.length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole("button", { name: /Compensada/i }));
      const compensadaItems = screen.getAllByText("Energia compensada");
      expect(compensadaItems.length).toBeGreaterThan(0);
    });

    it("filtra por texto de busca", () => {
      render(<GdExtractList entries={entries} />);

      const searchInput = screen.getByPlaceholderText(/Filtrar por mês/i);
      fireEvent.change(searchInput, { target: { value: "InexistenteMes999" } });

      expect(screen.getByText(/Nenhum lançamento encontrado/i)).toBeInTheDocument();
    });

    const PAGE_SIZE = 15;
    const renderedEntries = () => screen.queryAllByText(/^Energia (injetada|compensada)$/).length;

    it("mostra nos chips de GD I e GD II a quantidade de lançamentos de cada grupo e filtra por eles", () => {
      render(<GdExtractList entries={entries} />);

      for (const [grupo, label] of [[1, /GD I ·/], [2, /GD II ·/]] as const) {
        const total = entries.filter((e) => e.grupo === grupo).length;
        const chip = screen.getByRole("button", { name: label });
        expect(chip).toHaveTextContent(`(${total})`);

        fireEvent.click(chip);
        expect(renderedEntries()).toBe(Math.min(total, PAGE_SIZE));
      }

      fireEvent.click(screen.getByRole("button", { name: /Todos/i }));
      expect(renderedEntries()).toBeGreaterThan(0);
    });

    it("limpa a busca pelo botão ao lado do campo", () => {
      render(<GdExtractList entries={entries} />);
      const searchInput = screen.getByPlaceholderText(/Filtrar por mês/i);

      fireEvent.change(searchInput, { target: { value: "InexistenteMes999" } });
      fireEvent.click(searchInput.parentElement!.querySelector("button")!);

      expect(searchInput).toHaveValue("");
      expect(renderedEntries()).toBeGreaterThan(0);
    });

    it("carrega mais lançamentos pelo botão e pela rolagem da lista", () => {
      const { container } = render(<GdExtractList entries={entries} />);
      const initial = renderedEntries();
      expect(initial).toBeLessThan(entries.length);

      fireEvent.click(screen.getByRole("button", { name: /Carregar mais lançamentos/ }));
      const afterClick = renderedEntries();
      expect(afterClick).toBe(Math.min(initial + PAGE_SIZE, entries.length));

      const list = container.querySelector<HTMLElement>("[class*='overflow-y']")!;
      Object.defineProperties(list, {
        scrollTop: { value: 1000, configurable: true },
        scrollHeight: { value: 1050, configurable: true },
        clientHeight: { value: 40, configurable: true },
      });
      fireEvent.scroll(list);
      expect(renderedEntries()).toBeGreaterThanOrEqual(afterClick);
    });
  });

  describe("ConsumptionHistoryChart", () => {
    const sampleHistory: HistoricoConsumoMes[] = [
      { mes: "Jan/26", kwh: 120, valor: 95.5 },
      { mes: "Fev/26", kwh: 140, valor: 110.2 },
      { mes: "Mar/26", kwh: 115, valor: 90.0 },
    ];

    it("renderiza o gráfico de barras do histórico de consumo", () => {
      render(<ConsumptionHistoryChart data={sampleHistory} />);

      expect(screen.getByText("Histórico de Consumo")).toBeInTheDocument();
      expect(screen.getByText(/Últimos 3 meses faturados/i)).toBeInTheDocument();
    });

    it("retorna null se os dados forem vazios", () => {
      const { container } = render(<ConsumptionHistoryChart data={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });
});
