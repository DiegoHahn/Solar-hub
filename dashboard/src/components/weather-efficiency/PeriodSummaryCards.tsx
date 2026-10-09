"use client";

import { RiSunLine, RiRainyLine, RiSunCloudyLine, RiFlashlightLine } from "@remixicon/react";
import type { WeatherPeriodSummary, WeatherRange } from "@/lib/weatherEfficiency";
import { useI18n, formatNumber } from "@/i18n";

interface PeriodSummaryCardsProps {
  range: WeatherRange;
  summary: WeatherPeriodSummary;
}

/** Day counts by sky condition, accumulated rain and total generation for the 30- or 90-day period. */
export function PeriodSummaryCards({ range, summary }: PeriodSummaryCardsProps) {
  const { t, locale } = useI18n();
  const { sunnyDays, partlyCloudyDays, rainyDays, totalRainMm, totalKwh, avgHsp } = summary;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-center dark:border-amber-500/30 dark:bg-amber-950/20">
        <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          <RiSunLine className="size-3.5" />
          {t.combined.sunnyDaysLabel}
        </div>
        <div className="mt-0.5 text-lg font-bold text-amber-600 dark:text-amber-400">
          {sunnyDays} <span className="text-xs font-normal text-gray-500">{t.common.days}</span>
        </div>
        <p className="text-[10px] text-gray-500">{t.combined.clearSkyFull}</p>
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 text-center dark:border-blue-500/30 dark:bg-blue-950/20">
        <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          <RiSunCloudyLine className="size-3.5" />
          {t.combined.cloudSunDaysLabel}
        </div>
        <div className="mt-0.5 text-lg font-bold text-blue-600 dark:text-blue-400">
          {partlyCloudyDays} <span className="text-xs font-normal text-gray-500">{t.common.days}</span>
        </div>
        <p className="text-[10px] text-gray-500">{t.combined.partlyCloudyDesc}</p>
      </div>

      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-2.5 text-center dark:border-cyan-500/30 dark:bg-cyan-950/20">
        <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
          <RiRainyLine className="size-3.5" />
          {t.combined.rainyDaysLabel}
        </div>
        <div className="mt-0.5 text-lg font-bold text-cyan-600 dark:text-cyan-400">
          {rainyDays} <span className="text-xs font-normal text-gray-500">{t.common.days}</span>
        </div>
        <p className="text-[10px] text-gray-500">{t.combined.accumulatedRain.replace("{mm}", totalRainMm.toFixed(0))}</p>
      </div>

      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-2.5 text-center dark:border-purple-500/30 dark:bg-purple-950/20">
        <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
          <RiFlashlightLine className="size-3.5" />
          {range === "90d" ? t.combined.generation90d : t.combined.generationMonth}
        </div>
        <div className="mt-0.5 text-lg font-bold text-purple-600 dark:text-purple-400">
          {formatNumber(totalKwh, locale, { maximumFractionDigits: 0 })}{" "}
          <span className="text-xs font-normal text-gray-500">kWh</span>
        </div>
        <p className="text-[10px] text-gray-500">{t.combined.avgHspDaily.replace("{hsp}", avgHsp)}</p>
      </div>
    </div>
  );
}
