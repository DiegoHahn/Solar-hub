"use client";

import { RiSunLine, RiContrastDropLine, RiSpeedUpLine } from "@remixicon/react";
import { cx } from "@/lib/utils";
import { performanceQuality, type PerformanceQuality, type WeatherRange } from "@/lib/weatherEfficiency";
import { useI18n, formatNumber } from "@/i18n";

interface DiagnosticCardsProps {
  range: WeatherRange;
  prStats: { prPercent: number } | null;
  cloudLossStats: { lostKwh: number } | null;
  avgHsp: string;
}

const QUALITY_CLASS: Record<PerformanceQuality, string> = {
  excellent: "text-emerald-600 dark:text-emerald-400",
  good: "text-blue-600 dark:text-blue-400",
  regular: "text-amber-600 dark:text-amber-400",
};

/** Performance ratio, energy lost to clouds and average Peak Sun Hours of the period. */
export function DiagnosticCards({ range, prStats, cloudLossStats, avgHsp }: DiagnosticCardsProps) {
  const { t, locale } = useI18n();
  const quality = prStats ? performanceQuality(prStats.prPercent) : null;
  const qualityLabel: Record<PerformanceQuality, string> = {
    excellent: t.combined.excellentQuality,
    good: t.combined.goodQuality,
    regular: t.combined.regularQuality,
  };

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <RiSpeedUpLine className="size-4" />
        </div>
        <div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.combined.performanceRatioTitle}</span>
          {prStats && quality ? (
            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {formatNumber(prStats.prPercent, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%{" "}
              <span className={cx("text-xs font-normal", QUALITY_CLASS[quality])}>{qualityLabel[quality]}</span>
            </div>
          ) : (
            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
              — <span className="text-xs font-normal text-gray-500">({t.combined.noMeasuredDays})</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <RiContrastDropLine className="size-4" />
        </div>
        <div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t.combined.cloudLossTitle.replace("{period}", range)}
          </span>
          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {cloudLossStats ? (
              <>
                ~{formatNumber(cloudLossStats.lostKwh, locale, { maximumFractionDigits: 0 })} kWh{" "}
                <span className="text-xs font-normal text-gray-500">
                  {range === "90d" ? t.combined.inQuarter : range === "30d" ? t.combined.inMonth : t.combined.inWeek}
                </span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
          <RiSunLine className="size-4" />
        </div>
        <div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t.combined.avgHspPeriod.replace("{period}", range)}
          </span>
          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(Number(avgHsp), locale, { minimumFractionDigits: 2 })} {t.common.hoursPerDay} <span className="text-xs font-normal text-gray-500">{t.combined.fullSunLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
