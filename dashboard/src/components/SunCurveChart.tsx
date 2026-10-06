"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useIsClient } from "@/lib/useIsClient";
import { getActiveDatum, getSunCurveYAxisConfig } from "@/lib/chartUtils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { RiSunLine, RiFlashlightLine } from "@remixicon/react";
import type { SunCurvePoint } from "@/lib/types";
import { useI18n, type Locale } from "@/i18n";

interface SunCurveChartProps {
  data: SunCurvePoint[];
  nominalCapKw?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SunCurvePoint }>;
  label?: string;
  nominalCapKw: number;
  onActivePoint?: (point: SunCurvePoint) => void;
  canUpdate?: boolean;
  locale?: Locale;
  percentOfPlantText?: string;
  totalPowerText?: string;
}

export function SunCurveTooltip({
  active,
  payload,
  label,
  nominalCapKw,
  onActivePoint,
  canUpdate = true,
  locale = "en",
  percentOfPlantText = "{percent}% of plant",
  totalPowerText = "Total Power:",
}: CustomTooltipProps) {
  useEffect(() => {
    if (active && payload && payload.length > 0 && onActivePoint && canUpdate) {
      const point = payload[0]?.payload as SunCurvePoint | undefined;
      if (point) {
        onActivePoint(point);
      }
    }
  }, [active, payload, onActivePoint, canUpdate]);

  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload as SunCurvePoint;
  if (point.power_kw === null || point.power_kw === undefined) return null;
  const pct = Math.round((point.power_kw / nominalCapKw) * 100);
  const isOver = pct > 100;

  return (
    <div className="hidden md:block rounded-lg border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 text-xs">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-1.5 dark:border-gray-800">
        <span className="font-semibold text-gray-900 dark:text-gray-100">{label}</span>
        <Badge variant={isOver ? "warning" : "neutral"} className="text-[10px] px-1.5 py-0.5">
          {percentOfPlantText.replace("{percent}", String(pct))}
        </Badge>
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-4 font-semibold text-amber-500">
          <span>{totalPowerText}</span>
          <span className="tabular-nums">{point.power_kw.toLocaleString(locale, { minimumFractionDigits: 1 })} kW</span>
        </div>

        {point.solis_kw != null && (
          <div className="flex items-center justify-between gap-4 text-gray-500 dark:text-gray-400">
            <span>Solis 6kW:</span>
            <span className="tabular-nums">{point.solis_kw.toLocaleString(locale, { minimumFractionDigits: 1 })} kW</span>
          </div>
        )}

        {point.goodwe1_kw != null && (
          <div className="flex items-center justify-between gap-4 text-gray-500 dark:text-gray-400">
            <span>GoodWe #1 (5kW):</span>
            <span className="tabular-nums">{point.goodwe1_kw.toLocaleString(locale, { minimumFractionDigits: 1 })} kW</span>
          </div>
        )}

        {point.goodwe2_kw != null && (
          <div className="flex items-center justify-between gap-4 text-gray-500 dark:text-gray-400">
            <span>GoodWe #2 (5kW):</span>
            <span className="tabular-nums">{point.goodwe2_kw.toLocaleString(locale, { minimumFractionDigits: 1 })} kW</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SunCurveChart({ data, nominalCapKw = 16.0 }: SunCurveChartProps) {
  const { t, locale } = useI18n();
  const isMounted = useIsClient();
  const [inspectedPoint, setInspectedPoint] = useState<SunCurvePoint | null>(null);
  const [chartKey, setChartKey] = useState(0);
  const isResettingRef = useRef(false);

  const dataMax = useMemo(() => {
    return (data || []).reduce((acc, d) => Math.max(acc, d.power_kw ?? 0), 0);
  }, [data]);

  const yAxisConfig = useMemo(() => {
    return getSunCurveYAxisConfig(nominalCapKw, dataMax);
  }, [nominalCapKw, dataMax]);

  const handleReset = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isResettingRef.current = true;
    setInspectedPoint(null);
    setChartKey((k) => k + 1);
    setTimeout(() => {
      isResettingRef.current = false;
    }, 300);
  };

  if (!data || data.length === 0) {
    return null;
  }

  // Find daily peak power
  const fallbackPoint: SunCurvePoint = { power_kw: 0, time: "--:--", nominal_cap_kw: nominalCapKw };
  const peakPoint = data.reduce(
    (max, p) => ((p.power_kw ?? 0) > (max.power_kw ?? 0) ? p : max),
    data.find((p) => p.power_kw !== null) || fallbackPoint
  );
  const peakKw = peakPoint.power_kw ?? 0;
  const peakPct = Math.round((peakKw / nominalCapKw) * 100);
  const isPeakOverload = peakPct > 100;

  const displayPoint = inspectedPoint || peakPoint;
  const displayKw = displayPoint.power_kw ?? 0;
  const isInspecting = inspectedPoint !== null;

  return (
    <Card className="relative overflow-hidden p-4 md:p-6">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <RiSunLine className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t.inverters.sunCurveToday}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t.inverters.solarWindowSubtitle}
          </p>
        </div>

        {/* Daily Peak Badge (Desktop) */}
        <div className="hidden sm:flex items-center gap-2">
          <Badge
            variant={isPeakOverload ? "warning" : "default"}
            className="flex items-center gap-1 text-xs py-1 px-2.5"
          >
            <RiFlashlightLine className="size-3.5" />
            {t.inverters.peakAt
              .replace("{peak}", `${peakKw.toLocaleString(locale, { minimumFractionDigits: 1 })} kW`)
              .replace("{time}", peakPoint.time)
              .replace("{percent}", String(peakPct))}
          </Badge>
        </div>
      </div>

      {/* MOBILE EXCLUSIVE INSPECTION PANEL */}
      <div className="block sm:hidden mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs transition-all">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {t.common.time} {displayPoint.time}:
              </span>
              <span className="text-xl font-extrabold text-amber-500 tabular-nums">
                {displayKw.toLocaleString(locale, { minimumFractionDigits: 1 })}
                <span className="ml-1 text-xs font-semibold text-amber-500/80">kW</span>
              </span>
              <Badge
                variant={Math.round((displayKw / nominalCapKw) * 100) > 100 ? "warning" : "neutral"}
                className="text-[10px] px-1.5 py-0"
              >
                {t.inverters.percentPeak.replace("{percent}", String(Math.round((displayKw / nominalCapKw) * 100)))}
              </Badge>
            </div>
            {isInspecting && (
              <button
                type="button"
                onClick={handleReset}
                onTouchEnd={handleReset}
                className="relative z-10 shrink-0 cursor-pointer rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 active:bg-amber-500/30 dark:text-amber-400"
              >
                {t.common.back}
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-500/15 text-xs text-gray-600 dark:text-gray-300">
            <div>Solis: <strong className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{displayPoint.solis_kw?.toFixed(1) ?? "0"} kW</strong></div>
            <div>GoodWe 1: <strong className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{displayPoint.goodwe1_kw?.toFixed(1) ?? "0"} kW</strong></div>
            <div>GoodWe 2: <strong className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{displayPoint.goodwe2_kw?.toFixed(1) ?? "0"} kW</strong></div>
          </div>
        </div>
      </div>

      {/* Recharts Chart */}
      <div className="mt-3 md:mt-4 h-52 w-full">
        {!isMounted ? (
          <div className="size-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/40" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              key={chartKey}
              data={data}
              margin={{ top: 16, right: 8, left: -4, bottom: 0 }}
              onClick={(state) => {
                if (isResettingRef.current) return;
                const point = getActiveDatum(state, data);
                if (point && point.power_kw !== null && point.power_kw !== undefined) {
                  setInspectedPoint(point);
                }
              }}
            >
              <defs>
                <linearGradient id="sunGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                ticks={[
                  "05:00", "06:00", "07:00", "08:00", "09:00", "10:00",
                  "11:00", "12:00", "13:00", "14:00", "15:00", "16:00",
                  "17:00", "18:00", "19:00", "20:00"
                ]}
                tickFormatter={(val: string) => val ? val.slice(0, 5) : ""}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                domain={yAxisConfig.domain}
                ticks={yAxisConfig.ticks}
                tickFormatter={(val) => `${val} kW`}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />

              <Tooltip
                content={
                  <SunCurveTooltip
                    nominalCapKw={nominalCapKw}
                    locale={locale}
                    percentOfPlantText={t.inverters.percentOfPlant}
                    totalPowerText={t.inverters.totalPower}
                    onActivePoint={(p) => {
                      if (!isResettingRef.current) {
                        setInspectedPoint(p);
                      }
                    }}
                  />
                }
                cursor={{ stroke: "#f59e0b", strokeWidth: 1, strokeDasharray: "3 3" }}
              />

              {/* Reference line for nominal capacity */}
              <ReferenceLine
                y={nominalCapKw}
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{
                  value: t.inverters.nominalLabel.replace("{capacity}", String(nominalCapKw)),
                  fill: "#94a3b8",
                  position: "insideTopRight",
                  fontSize: 10,
                }}
              />

              <Area
                type="monotone"
                dataKey="power_kw"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fill="url(#sunGradient)"
                connectNulls={false}
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom legend */}
      <div className="mt-3 flex flex-wrap items-center justify-between border-t border-gray-100 pt-2.5 dark:border-gray-900 text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500" />
          <span>{t.inverters.actualGeneration}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 border-t-2 border-dashed border-slate-400" />
          <span>{t.inverters.approvedCapacity.replace("{capacity}", "16.0")}</span>
        </div>
      </div>
    </Card>
  );
}
