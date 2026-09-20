"use client";

import { useState } from "react";
import { cx } from "@/lib/utils";
import { InverterCurveChart } from "@/components/InverterCurveChart";
import { GenerationBarChart } from "@/components/GenerationBarChart";
import type { SunCurvePoint, GenerationPoint } from "@/lib/types";

type Period = "dia" | "mes" | "ano";

const PERIODS: { key: Period; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
];

interface GenerationPeriodSectionProps {
  dayCurve: SunCurvePoint[];
  monthData: GenerationPoint[];
  yearData: GenerationPoint[];
}

export function GenerationPeriodSection({
  dayCurve,
  monthData,
  yearData,
}: GenerationPeriodSectionProps) {
  const [period, setPeriod] = useState<Period>("dia");

  return (
    <div className="space-y-4">
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

      {period === "dia" && (
        dayCurve.length > 0 ? (
          <InverterCurveChart data={dayCurve} />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
            Nenhuma curva de geração registrada para o dia de hoje ainda.
          </div>
        )
      )}
      {period === "mes" && (
        monthData.length > 0 ? (
          <GenerationBarChart
            data={monthData}
            title="Geração Mensal"
            subtitle="Total gerado por dia — mês atual"
            unitLabel="kWh"
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
            Nenhum histórico diário acumulado neste mês ainda.
          </div>
        )
      )}
      {period === "ano" && (
        yearData.length > 0 ? (
          <GenerationBarChart
            data={yearData}
            title="Geração Anual"
            subtitle="Total gerado por mês — últimos 12 meses"
            unitLabel="kWh"
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
            Nenhum histórico anual disponível na concessionária ainda.
          </div>
        )
      )}
    </div>
  );
}
