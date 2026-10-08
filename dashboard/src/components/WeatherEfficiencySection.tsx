"use client";

import { useState, useEffect, useRef } from "react";
import { getActiveDatum } from "@/lib/chartUtils";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  RiSunLine,
  RiCloudLine,
  RiRainyLine,
  RiThunderstormsLine,
  RiSunCloudyLine,
  RiContrastDropLine,
  RiSpeedUpLine,
  RiFlashlightLine,
} from "@remixicon/react";
import { Card } from "@/components/Card";
import { cx } from "@/lib/utils";
import {
  DailyWeather,
  calculatePerformanceRatio,
  calculateCloudLoss,
  PLANT_DC_KWP,
} from "@/lib/weather";
import { useI18n, formatNumber, type Locale } from "@/i18n";

interface CustomWeatherTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DailyWeather }>;
  onActivePoint?: (point: DailyWeather) => void;
  renderIcon: (icon: DailyWeather["icon"], className?: string) => React.ReactNode;
  locale?: Locale;
}


export function formatWeatherDate(dateStr: string, locale: Locale): { dayOfWeek: string; formattedDate: string } {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const intlLocale = locale === "pt-BR" ? "pt-BR" : "en-US";
    const dayOfWeek = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" })
      .format(date)
      .replace(".", "");
    const formattedDate = new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit", timeZone: "UTC" })
      .format(date);
    // Capitalize first letter of weekday
    const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    return { dayOfWeek: capitalizedDay, formattedDate };
  } catch {
    return { dayOfWeek: "", formattedDate: dateStr };
  }
}

export function WeatherTooltip({ active, payload, onActivePoint, renderIcon, locale = "pt-BR" }: CustomWeatherTooltipProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (active && payload && payload.length > 0 && onActivePoint) {
      const p = payload[0]?.payload;
      if (p) {
        onActivePoint(p);
      }
    }
  }, [active, payload, onActivePoint]);

  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  const { dayOfWeek, formattedDate } = formatWeatherDate(p.date, locale);
  const conditionLabel = t.weather[p.conditionKey];

  return (
    <div className="hidden md:block rounded-xl border border-gray-800 bg-gray-950/95 p-3 text-xs text-gray-100 shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-1.5 font-bold text-gray-200">
        {renderIcon(p.icon)}
        <span>{dayOfWeek}, {formattedDate} — {conditionLabel}</span>
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex justify-between gap-4 text-amber-400">
          <span>{p.isReal ? t.combined.tooltipRealGeneration : t.combined.tooltipEstimatedGeneration}</span>
          <strong>{formatNumber(p.estimatedKwh, locale, { minimumFractionDigits: 1 })} kWh</strong>
        </div>
        <div className="flex justify-between gap-4 text-cyan-400">
          <span>{t.combined.tooltipSolarIrradiation}</span>
          <strong>{formatNumber(p.solarRadiationHsp, locale, { minimumFractionDigits: 1 })} h (kWh/m²)</strong>
        </div>
        <div className="flex justify-between gap-4 text-gray-400">
          <span>{t.combined.tooltipSunshineHours}</span>
          <strong>{formatNumber(p.sunshineHours, locale, { minimumFractionDigits: 1 })} h</strong>
        </div>
        <div className="flex justify-between gap-4 text-blue-400">
          <span>{t.combined.tooltipPrecipitation}</span>
          <strong>{formatNumber(p.precipitationMm, locale)} mm</strong>
        </div>
      </div>
    </div>
  );
}

interface WeatherEfficiencySectionProps {
  weatherData?: DailyWeather[];
  /** Compact version for Overview page (without large technical footer cards) */
  compact?: boolean;
}

export function WeatherEfficiencySection({
  weatherData = [],
  compact = false,
}: WeatherEfficiencySectionProps) {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<"7d" | "30d" | "90d">("7d");

  // Show last 7, 30, or 90 days depending on range and compact mode
  const displayedData = compact
    ? weatherData.slice(-7)
    : range === "7d"
    ? weatherData.slice(-7)
    : range === "30d"
    ? weatherData.slice(-30)
    : weatherData.slice(-90);

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

  const point = displayedData.find((d) => d.date === activePoint?.date) || displayedData[displayedData.length - 1];

  // Period statistics
  const totalKwh = displayedData.reduce((acc, d) => acc + d.estimatedKwh, 0);
  const totalRainMm = displayedData.reduce((acc, d) => acc + d.precipitationMm, 0);
  const avgHsp = (displayedData.reduce((acc, d) => acc + d.solarRadiationHsp, 0) / (displayedData.length || 1)).toFixed(2);
  const sunnyDays = displayedData.filter((d) => d.weatherCode <= 1).length;
  const partlyCloudyDays = displayedData.filter((d) => d.weatherCode >= 2 && d.weatherCode <= 48).length;
  const rainyDays = displayedData.filter((d) => d.weatherCode >= 50).length;
  const prStats = calculatePerformanceRatio(displayedData);
  const cloudLossStats = calculateCloudLoss(displayedData, weatherData);

  const renderWeatherIcon = (icon: DailyWeather["icon"], className = "size-4") => {
    switch (icon) {
      case "sun":
        return <RiSunLine className={cx(className, "text-amber-500")} />;
      case "cloud-sun":
        return <RiSunCloudyLine className={cx(className, "text-amber-400")} />;
      case "cloud":
        return <RiCloudLine className={cx(className, "text-gray-400")} />;
      case "rain":
        return <RiRainyLine className={cx(className, "text-blue-400")} />;
      case "storm":
        return <RiThunderstormsLine className={cx(className, "text-purple-400")} />;
    }
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

        {/* Range Selector: 7d | 30d | 90d */}
        {!compact && (
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs">
            <button
              type="button"
              onClick={() => setRange("7d")}
              className={cx(
                "rounded-md px-2.5 py-1 font-semibold transition-colors",
                range === "7d"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-purple-600 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              {t.combined.days7}
            </button>
            <button
              type="button"
              onClick={() => setRange("30d")}
              className={cx(
                "rounded-md px-2.5 py-1 font-semibold transition-colors",
                range === "30d"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-purple-600 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              {t.combined.days30}
            </button>
            <button
              type="button"
              onClick={() => setRange("90d")}
              className={cx(
                "rounded-md px-2.5 py-1 font-semibold transition-colors",
                range === "90d"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-purple-600 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              {t.combined.days90}
            </button>
          </div>
        )}
      </div>

      {/* Dynamic Inspection Top Banner */}
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
                  {formatWeatherDate(point.date, locale).dayOfWeek}, {formatWeatherDate(point.date, locale).formattedDate}
                </span>
                <span className="rounded bg-gray-200/80 px-1.5 py-0.2 text-[10px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300 truncate max-w-[110px] sm:max-w-none">
                  {t.weather[point.conditionKey]}
                </span>
                {point.date !== (displayedData[displayedData.length - 1]?.date) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      resetCooldownRef.current = true;
                      setActivePoint(displayedData[displayedData.length - 1]);
                      setTimeout(() => {
                        resetCooldownRef.current = false;
                      }, 400);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      resetCooldownRef.current = true;
                      setActivePoint(displayedData[displayedData.length - 1]);
                      setTimeout(() => {
                        resetCooldownRef.current = false;
                      }, 400);
                    }}
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
                {point.solarRadiationHsp > 0
                  ? `${Math.min(150, Math.round((point.estimatedKwh / (PLANT_DC_KWP * point.solarRadiationHsp)) * 100))}%`
                  : "—"}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Composed Chart */}
      <div className="mt-3 h-48 sm:h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={displayedData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            onMouseMove={(state) => {
              if (resetCooldownRef.current) return;
              const p = getActiveDatum(state, displayedData);
              if (p) setActivePoint(p);
            }}
            onClick={(state) => {
              if (resetCooldownRef.current) return;
              const p = getActiveDatum(state, displayedData);
              if (p) setActivePoint(p);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) =>
                displayedData.find((d) => d.date === date)?.isToday
                  ? t.common.today
                  : formatWeatherDate(date, locale).formattedDate
              }
              tickLine={false}
              axisLine={false}
              interval={range === "90d" && !compact ? 14 : range === "30d" && !compact ? 4 : 0}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
            />
            <YAxis
              yAxisId="kwh"
              domain={[0, (max: number) => Math.max(80, Math.ceil(max / 20) * 20)]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(v) => `${v}`}
              width={24}
            />
            <YAxis
              yAxisId="hsp"
              orientation="right"
              domain={[0, 8]}
              ticks={[0, 2, 4, 6, 8]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#06b6d4", fontSize: 11 }}
              tickFormatter={(v) => `${v}h`}
              width={24}
            />
            <Tooltip
              content={
                <WeatherTooltip
                  locale={locale}
                  onActivePoint={setActivePoint}
                  renderIcon={renderWeatherIcon}
                />
              }
            />

            <defs>
              <linearGradient id="solarAmberGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {range === "90d" && !compact ? (
              <Area
                yAxisId="kwh"
                type="monotone"
                dataKey="estimatedKwh"
                name={t.combined.generationKwhPerDay}
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#solarAmberGrad)"
                dot={false}
              />
            ) : (
              <Bar
                yAxisId="kwh"
                dataKey="estimatedKwh"
                name={t.combined.generationKwhPerDay}
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                maxBarSize={range === "30d" && !compact ? 14 : 36}
              />
            )}

            <Line
              yAxisId="hsp"
              type="monotone"
              dataKey="solarRadiationHsp"
              name={t.combined.solarIrradiationHsp}
              stroke="#06b6d4"
              strokeWidth={range === "90d" && !compact ? 1.5 : range === "30d" && !compact ? 2 : 3}
              dot={range === "7d" || compact ? { r: 4, fill: "#06b6d4" } : false}
              activeDot={{ r: 6, fill: "#22d3ee" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-6 border-t border-gray-100 pt-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          {range === "90d" && !compact ? (
            <span className="h-0.5 w-3 bg-amber-500" />
          ) : (
            <span className="size-2.5 rounded-sm bg-amber-500" />
          )}
          <span>{t.combined.generationKwhPerDay}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-cyan-500" />
          <span>{t.combined.solarIrradiationHsp}</span>
        </div>
      </div>

      {/* Historical Weather Summary (30d or 90d) */}
      {!compact && (range === "30d" || range === "90d") && (
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
      )}

      {/* Diagnostic Cards */}
      {!compact && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <RiSpeedUpLine className="size-4" />
            </div>
            <div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.combined.performanceRatioTitle}</span>
              {prStats ? (
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(prStats.prPercent, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%{" "}
                  <span
                    className={cx(
                      "text-xs font-normal",
                      prStats.prPercent >= 80
                        ? "text-emerald-600 dark:text-emerald-400"
                        : prStats.prPercent >= 70
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {prStats.prPercent >= 80
                      ? t.combined.excellentQuality
                      : prStats.prPercent >= 70
                      ? t.combined.goodQuality
                      : t.combined.regularQuality}
                  </span>
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
      )}
    </Card>
  );
}
