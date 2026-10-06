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

import { ptBR } from "@/i18n/locales/pt-BR";

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

  it("starts on Day tab by default", () => {
    render(
      <GenerationPeriodSection
        dayCurve={dayCurve}
        monthData={monthData}
        multiYearHistory={multiYear}
      />,
    );

    expect(screen.getByRole("button", { name: ptBR.combined.periodDay })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ptBR.combined.periodMonth })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ptBR.combined.periodYear })).toBeInTheDocument();
  });

  it("switches to Month tab and displays accumulated monthly total", () => {
    render(
      <GenerationPeriodSection
        dayCurve={dayCurve}
        monthData={monthData}
        multiYearHistory={multiYear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: ptBR.combined.periodMonth }));

    expect(screen.getByText(ptBR.combined.monthlyGeneration)).toBeInTheDocument();
    expect(screen.getByText(ptBR.combined.monthlyGenerationSubtitle)).toBeInTheDocument();

    const expectedTotal = monthData.reduce((acc, d) => acc + d.kwh, 0);
    const formatted = expectedTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " kWh";
    expect(screen.getAllByText(formatted).length).toBeGreaterThan(0);
  });

  it("switches to Year tab and allows toggling between annual filters", () => {
    render(
      <GenerationPeriodSection
        dayCurve={dayCurve}
        monthData={monthData}
        multiYearHistory={multiYear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: ptBR.combined.periodYear }));

    expect(screen.getByText(ptBR.combined.annualGeneration12m)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ptBR.combined.months12 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ptBR.combined.allYears })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: ptBR.combined.allYears }));
    expect(screen.getByText(ptBR.combined.historicalComparative)).toBeInTheDocument();
    expect(screen.getByText(ptBR.combined.historicalComparativeSub)).toBeInTheDocument();

    if (multiYear.availableYears.length > 0) {
      const year = multiYear.availableYears[0];
      fireEvent.click(screen.getByRole("button", { name: year }));
      const expectedTitle = ptBR.combined.annualGenerationYear.replace("{year}", year);
      expect(screen.getByText(expectedTitle)).toBeInTheDocument();
    }
  });

  it("displays empty state message when tab has no data", () => {
    render(
      <GenerationPeriodSection
        dayCurve={[]}
        monthData={[]}
      />,
    );

    expect(screen.getByText(ptBR.combined.noCurveToday)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: ptBR.combined.periodMonth }));
    expect(screen.getByText(ptBR.combined.noMonthlyHistory)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: ptBR.combined.periodYear }));
    expect(screen.getByText(ptBR.combined.noAnnualHistory)).toBeInTheDocument();
  });
});
