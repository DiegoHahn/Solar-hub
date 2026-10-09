"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/Card";
import { cx } from "@/lib/utils";
import { DailyWeather, calculatePerformanceRatio, calculateCloudLoss } from "@/lib/weather";
import {
  selectDisplayedDays,
  summarizeWeatherPeriod,
  weatherChartStyle,
  type WeatherRange,
} from "@/lib/weatherEfficiency";
import { useI18n } from "@/i18n";
import { RangeSelector } from "@/components/weather-efficiency/RangeSelector";
import { DayInspectionBanner } from "@/components/weather-efficiency/DayInspectionBanner";
import { WeatherEfficiencyChart } from "@/components/weather-efficiency/WeatherEfficiencyChart";
import { PeriodSummaryCards } from "@/components/weather-efficiency/PeriodSummaryCards";
import { DiagnosticCards } from "@/components/weather-efficiency/DiagnosticCards";

/** After "today" is pressed, chart hover events are ignored briefly so the pointer does not undo the reset. */
const RESET_COOLDOWN_MS = 400;

interface WeatherEfficiencySectionProps {
  weatherData?: DailyWeather[];
  /** Compact version for Overview page (without large technical footer cards) */
  compact?: boolean;
}

export function WeatherEfficiencySection({
  weatherData = [],
  compact = false,
}: WeatherEfficiencySectionProps) {
  const { t } = useI18n();
  const [range, setRange] = useState<WeatherRange>("7d");

  const displayedData = selectDisplayedDays(weatherData, range, compact);

  const [activePoint, setActivePoint] = useState<DailyWeather>(
    displayedData[displayedData.length - 1] || weatherData[weatherData.length - 1]
  );
  const resetCooldownRef = useRef(false);

  if (weatherData.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t.combined.weatherUnavailable}</p>
      </Card>
    );
  }

  const latest = displayedData[displayedData.length - 1];
  const point = displayedData.find((d) => d.date === activePoint?.date) || latest;

  const summary = summarizeWeatherPeriod(displayedData);
  const prStats = calculatePerformanceRatio(displayedData);
  const cloudLossStats = calculateCloudLoss(displayedData, weatherData);

  const inspect = (p: DailyWeather) => {
    if (resetCooldownRef.current) return;
    setActivePoint(p);
  };

  const resetToLatest = () => {
    resetCooldownRef.current = true;
    setActivePoint(latest);
    setTimeout(() => {
      resetCooldownRef.current = false;
    }, RESET_COOLDOWN_MS);
  };

  return (
    <Card className={cx("p-4 sm:p-5", !compact && "sm:p-6")}>
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900 sm:text-base dark:text-gray-100">
            {compact ? t.combined.sunVsGeneration7d : t.combined.weatherVsEfficiencyTitle}
          </h2>
          {!compact && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              Open-Meteo · Içara/SC
            </span>
          )}
        </div>

        {!compact && <RangeSelector range={range} onChange={setRange} />}
      </div>

      <DayInspectionBanner point={point} showReset={point.date !== latest?.date} onReset={resetToLatest} />

      <WeatherEfficiencyChart
        data={displayedData}
        chartStyle={weatherChartStyle(range, compact)}
        onInspect={inspect}
        onTooltipPoint={setActivePoint}
      />

      {/* Historical Weather Summary (30d or 90d) */}
      {!compact && (range === "30d" || range === "90d") && <PeriodSummaryCards range={range} summary={summary} />}

      {!compact && (
        <DiagnosticCards range={range} prStats={prStats} cloudLossStats={cloudLossStats} avgHsp={summary.avgHsp} />
      )}
    </Card>
  );
}
