"use client";

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
import { getActiveDatum } from "@/lib/chartUtils";
import type { DailyWeather } from "@/lib/weather";
import { formatWeatherDate, type WeatherChartStyle } from "@/lib/weatherEfficiency";
import { useI18n } from "@/i18n";
import { renderWeatherIcon } from "./WeatherIcon";
import { WeatherTooltip } from "./WeatherTooltip";

interface WeatherEfficiencyChartProps {
  data: DailyWeather[];
  chartStyle: WeatherChartStyle;
  /** Day under the pointer or tapped on the chart. */
  onInspect: (point: DailyWeather) => void;
  /** Day reported by the hover tooltip. */
  onTooltipPoint: (point: DailyWeather) => void;
}

/** Daily generation (bars, or area for 90 days) against irradiation in Peak Sun Hours, with its legend. */
export function WeatherEfficiencyChart({ data, chartStyle, onInspect, onTooltipPoint }: WeatherEfficiencyChartProps) {
  const { t, locale } = useI18n();

  const inspectActive = (state: Parameters<typeof getActiveDatum>[0]) => {
    const p = getActiveDatum(state, data);
    if (p) onInspect(p);
  };

  return (
    <>
      <div className="mt-3 h-48 sm:h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            onMouseMove={inspectActive}
            onClick={inspectActive}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) =>
                data.find((d) => d.date === date)?.isToday
                  ? t.common.today
                  : formatWeatherDate(date, locale).formattedDate
              }
              tickLine={false}
              axisLine={false}
              interval={chartStyle.xAxisInterval}
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
                  onActivePoint={onTooltipPoint}
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

            {chartStyle.useArea ? (
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
                maxBarSize={chartStyle.maxBarSize}
              />
            )}

            <Line
              yAxisId="hsp"
              type="monotone"
              dataKey="solarRadiationHsp"
              name={t.combined.solarIrradiationHsp}
              stroke="#06b6d4"
              strokeWidth={chartStyle.irradiationStrokeWidth}
              dot={chartStyle.showIrradiationDots ? { r: 4, fill: "#06b6d4" } : false}
              activeDot={{ r: 6, fill: "#22d3ee" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-6 border-t border-gray-100 pt-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          {chartStyle.useArea ? (
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
    </>
  );
}
