"use client";

import { useState } from "react";
import { cx } from "@/lib/utils";
import { InverterCurveChart } from "@/components/InverterCurveChart";
import { GenerationBarChart } from "@/components/GenerationBarChart";
import type { SunCurvePoint, GenerationPoint, MultiYearHistory } from "@/lib/types";
import { useI18n } from "@/i18n";

type Period = "day" | "month" | "year";

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
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>("day");
  const [annualFilter, setAnnualFilter] = useState<string>("last12");

  const periods: { key: Period; label: string }[] = [
    { key: "day", label: t.combined.periodDay },
    { key: "month", label: t.combined.periodMonth },
    { key: "year", label: t.combined.periodYear },
  ];

  // Chart data for "Year" tab
  let annualChartData: GenerationPoint[] = yearData;
  let annualTitle = t.combined.periodYear;
  let annualSubtitle = t.combined.annualGeneration12mSub;

  if (multiYearHistory) {
    if (annualFilter === "last12") {
      annualChartData = multiYearHistory.last12Months;
      annualTitle = t.combined.annualGeneration12m;
      annualSubtitle = t.combined.annualGeneration12mSub;
    } else if (annualFilter === "comparative") {
      annualChartData = multiYearHistory.yearsTotals;
      annualTitle = t.combined.historicalComparative;
      annualSubtitle = t.combined.historicalComparativeSub;
    } else if (multiYearHistory.byYear[annualFilter]) {
      annualChartData = multiYearHistory.byYear[annualFilter];
      annualTitle = t.combined.annualGenerationYear.replace("{year}", annualFilter);
      annualSubtitle = t.combined.annualGenerationYearSub.replace("{year}", annualFilter);
    }
  }

  return (
    <div className="space-y-4">
      {/* Main tab bar: Day | Month | Year */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900/60">
          {periods.map((p) => (
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

        {/* Annual sub-filter when "Year" is active */}
        {period === "year" && multiYearHistory && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setAnnualFilter("last12")}
              className={cx(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                annualFilter === "last12"
                  ? "bg-amber-500 text-white shadow-xs font-semibold"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
              )}
            >
              {t.combined.months12}
            </button>

            <button
              type="button"
              onClick={() => setAnnualFilter("comparative")}
              className={cx(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                annualFilter === "comparative"
                  ? "bg-amber-500 text-white shadow-xs font-semibold"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
              )}
            >
              {t.combined.allYears}
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

      {/* Selected tab content */}
      {period === "day" &&
        (dayCurve.length > 0 ? (
          <InverterCurveChart data={dayCurve} />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
            {t.combined.noCurveToday}
          </div>
        ))}

      {period === "month" &&
        (monthData.length > 0 ? (
          <GenerationBarChart
            data={monthData}
            title={t.combined.monthlyGeneration}
            subtitle={t.combined.monthlyGenerationSubtitle}
            unitLabel="kWh"
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
            {t.combined.noMonthlyHistory}
          </div>
        ))}

      {period === "year" &&
        (annualChartData.length > 0 ? (
          <GenerationBarChart
            data={annualChartData}
            title={annualTitle}
            subtitle={annualSubtitle}
            unitLabel="kWh"
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
            {t.combined.noAnnualHistory}
          </div>
        ))}
    </div>
  );
}
