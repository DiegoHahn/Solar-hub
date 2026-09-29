import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GenerationPeriodSection } from "./GenerationPeriodSection";
import {
  buildSunCurveGrid,
  buildMultiYearHistory,
  mergeDailyGeneration,
  type SunCurveRow,
  type DailyGenerationRow,
  type InverterDailyHistoryRow,
} from "@/lib/queries";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";
import monthlyHistoryFixture from "../test/fixtures/monthly-history.json";
import dailyGenFixture from "../test/fixtures/daily-generation.json";
import type { InverterMonthlyHistoryRow, GenerationPoint } from "@/lib/types";

describe("GenerationPeriodSection", () => {
  const targetDate = "2026-09-29";
  const nighttime = new Date(`${targetDate}T22:00:00-03:00`);
  const dayCurve = buildSunCurveGrid(
    telemetryDayFixture as unknown as SunCurveRow[],
    targetDate,
    nighttime,
  );
  const dailyEntries = mergeDailyGeneration(
    dailyGenFixture.view as DailyGenerationRow[],
    dailyGenFixture.history as InverterDailyHistoryRow[],
  );
  const multiYear = buildMultiYearHistory(
    monthlyHistoryFixture as unknown as InverterMonthlyHistoryRow[],
    dailyEntries,
    "2026-09",
    targetDate,
  );
  const monthData: GenerationPoint[] = [
    { label: "01", kwh: 45.2 },
    { label: "02", kwh: 50.1 },
    { label: "03", kwh: 38.7 },
  ];

  it("inicia na aba Dia por padrão", () => {
    render(
      <GenerationPeriodSection
        dayCurve={dayCurve}
        monthData={monthData}
        multiYearHistory={multiYear}
      />,
    );

    expect(screen.getByRole("button", { name: "Dia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mês" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ano" })).toBeInTheDocument();
  });

  it("troca para a aba Mês e exibe o total acumulado do mês", () => {
    render(
      <GenerationPeriodSection
        dayCurve={dayCurve}
        monthData={monthData}
        multiYearHistory={multiYear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mês" }));

    expect(screen.getByText("Geração Mensal")).toBeInTheDocument();
    expect(screen.getByText("Total bruto gerado por dia — mês atual")).toBeInTheDocument();

    const expectedTotal = monthData.reduce((acc, d) => acc + d.kwh, 0);
    const formatted = expectedTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " kWh";
    expect(screen.getAllByText(formatted).length).toBeGreaterThan(0);
  });

  it("troca para a aba Ano e permite alternar entre filtros anuais", () => {
    render(
      <GenerationPeriodSection
        dayCurve={dayCurve}
        monthData={monthData}
        multiYearHistory={multiYear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ano" }));

    expect(screen.getByText("Geração Anual — Últimos 12 Meses")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12 Meses" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todos os Anos" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Todos os Anos" }));
    expect(screen.getByText("Comparativo Histórico por Ano")).toBeInTheDocument();
    expect(screen.getByText("Total bruto gerado pela usina a cada ano")).toBeInTheDocument();

    if (multiYear.availableYears.length > 0) {
      const year = multiYear.availableYears[0];
      fireEvent.click(screen.getByRole("button", { name: year }));
      expect(screen.getByText(`Geração Anual — ${year}`)).toBeInTheDocument();
    }
  });

  it("exibe mensagem vazia quando não há dados na aba", () => {
    render(
      <GenerationPeriodSection
        dayCurve={[]}
        monthData={[]}
      />,
    );

    expect(screen.getByText(/Nenhuma curva de geração registrada/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    expect(screen.getByText(/Nenhum histórico diário acumulado/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ano" }));
    expect(screen.getByText(/Nenhum histórico anual disponível/)).toBeInTheDocument();
  });
});
