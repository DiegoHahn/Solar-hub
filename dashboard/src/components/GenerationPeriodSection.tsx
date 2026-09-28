"use client";

import { useState } from "react";
import { cx } from "@/lib/utils";
import { InverterCurveChart } from "@/components/InverterCurveChart";
import { GenerationBarChart } from "@/components/GenerationBarChart";
import type { SunCurvePoint, GenerationPoint, MultiYearHistory } from "@/lib/types";

type Period = "dia" | "mes" | "ano";

const PERIODS: { key: Period; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
];

interface GenerationPeriodSectionProps {
  dayCurve: SunCurvePoint[];
  monthData: GenerationPoint[];
  yearData?: GenerationPoint[];
  multiYearHistory?: MultiYearHistory;
}

export function GenerationPeriodSection({
  dayCurve,
  monthData,
  yearData = [],
  multiYearHistory,
}: GenerationPeriodSectionProps) {
  const [period, setPeriod] = useState<Period>("dia");
  const [annualFilter, setAnnualFilter] = useState<string>("ultimos_12");

  // Determina os dados do gráfico para a aba "Ano"
  let annualChartData: GenerationPoint[] = yearData;
  let annualTitle = "Geração Anual";
  let annualSubtitle = "Total bruto gerado por mês — últimos 12 meses";

  if (multiYearHistory) {
    if (annualFilter === "ultimos_12") {
      annualChartData = multiYearHistory.last12Months;
      annualTitle = "Geração Anual — Últimos 12 Meses";
      annualSubtitle = "Total bruto gerado a cada mês (visão móvel contínua)";
    } else if (annualFilter === "comparativo") {
      annualChartData = multiYearHistory.yearsTotals;
      annualTitle = "Comparativo Histórico por Ano";
      annualSubtitle = "Total bruto gerado pela usina a cada ano";
    } else if (multiYearHistory.byYear[annualFilter]) {
      annualChartData = multiYearHistory.byYear[annualFilter];
      annualTitle = `Geração Anual — ${annualFilter}`;
      annualSubtitle = `Total bruto gerado mês a mês em ${annualFilter}`;
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra principal de seleção: Dia | Mês | Ano */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900/60">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cx(
                "rounded-md px-4 py-1.5 text-xs font-medium transition-colors",
                period === p.key
                  ? "bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Sub-filtro de anos quando a aba "Ano" está ativa */}
        {period === "ano" && multiYearHistory && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setAnnualFilter("ultimos_12")}
              className={cx(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                annualFilter === "ultimos_12"
                  ? "bg-amber-500 text-white shadow-xs font-semibold"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
              )}
            >
              12 Meses
            </button>

            <button
              type="button"
              onClick={() => setAnnualFilter("comparativo")}
              className={cx(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                annualFilter === "comparativo"
                  ? "bg-amber-500 text-white shadow-xs font-semibold"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
              )}
            >
              Todos os Anos
            </button>

            {multiYearHistory.availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setAnnualFilter(yr)}
                className={cx(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  annualFilter === yr
                    ? "bg-amber-500 text-white shadow-xs font-semibold"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                )}
              >
                {yr}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo da aba selecionada */}
      {period === "dia" &&
        (dayCurve.length > 0 ? (
          <InverterCurveChart data={dayCurve} />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
            Nenhuma curva de geração registrada para o dia de hoje ainda.
          </div>
        ))}

      {period === "mes" &&
        (monthData.length > 0 ? (
          <GenerationBarChart
            data={monthData}
            title="Geração Mensal"
            subtitle="Total bruto gerado por dia — mês atual"
            unitLabel="kWh"
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
            Nenhum histórico diário acumulado neste mês ainda.
          </div>
        ))}

      {period === "ano" &&
        (annualChartData.length > 0 ? (
          <GenerationBarChart
            data={annualChartData}
            title={annualTitle}
            subtitle={annualSubtitle}
            unitLabel="kWh"
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
            Nenhum histórico anual disponível para o filtro selecionado.
          </div>
        ))}
    </div>
  );
}
