"use client";

import type { DailyWeather } from "@/lib/weather";
import { dayEfficiencyPercent, formatWeatherDate } from "@/lib/weatherEfficiency";
import { useI18n, formatNumber } from "@/i18n";
import { renderWeatherIcon } from "./WeatherIcon";

interface DayInspectionBannerProps {
  point: DailyWeather;
  /** Shows the "today" button that brings the inspection back to the latest day. */
  showReset: boolean;
  onReset: () => void;
}

/** Weather and key metrics of the day being inspected on the chart. */
export function DayInspectionBanner({ point, showReset, onReset }: DayInspectionBannerProps) {
  const { t, locale } = useI18n();
  const { dayOfWeek, formattedDate } = formatWeatherDate(point.date, locale);
  const efficiency = dayEfficiencyPercent(point);

  const handleReset = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onReset();
  };

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 sm:p-3 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Weather of the day */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-gray-800">
            {renderWeatherIcon(point.icon, "size-4")}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">
                {dayOfWeek}, {formattedDate}
              </span>
              <span className="rounded bg-gray-200/80 px-1.5 py-0.2 text-[10px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300 truncate max-w-[110px] sm:max-w-none">
                {t.weather[point.conditionKey]}
              </span>
              {showReset && (
                <button
                  type="button"
                  onClick={handleReset}
                  onTouchEnd={handleReset}
                  className="relative z-10 shrink-0 cursor-pointer rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 hover:bg-amber-500/20 active:bg-amber-500/30 dark:text-amber-400"
                >
                  {t.combined.todayReset}
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {point.tempMin}°C ~ {point.tempMax}°C
              {point.precipitationMm > 0 ? ` · ${point.precipitationMm} mm` : ""}
            </p>
          </div>
        </div>

        {/* Right: Key metrics */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 text-right">
          <div>
            <div className="flex items-center justify-end gap-1">
              <span className="block text-[10px] text-gray-500 dark:text-gray-400">{t.combined.generationLabel}</span>
              {point.isReal ? (
                <span className="rounded bg-emerald-500/10 px-1 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                  {t.combined.realBadge}
                </span>
              ) : (
                <span className="rounded bg-amber-500/10 px-1 py-0.2 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                  {t.combined.estBadge}
                </span>
              )}
            </div>
            <strong className="text-xs sm:text-base font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatNumber(point.estimatedKwh, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
              <span className="text-[10px] font-normal text-gray-500">kWh</span>
            </strong>
          </div>
          <div>
            <span className="block text-[10px] text-gray-500 dark:text-gray-400">{t.combined.sunHspLabel}</span>
            <strong className="text-xs sm:text-base font-extrabold text-cyan-600 dark:text-cyan-400 tabular-nums">
              {formatNumber(point.solarRadiationHsp, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
              <span className="text-[10px] font-normal text-gray-500">h</span>
            </strong>
          </div>
          <div>
            <span className="block text-[10px] text-gray-500 dark:text-gray-400">{t.combined.efficiencyLabel}</span>
            <strong className="text-xs sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {efficiency !== null ? `${efficiency}%` : "—"}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
