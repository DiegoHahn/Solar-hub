"use client";

import { useEffect, useState, useRef } from "react";
import { useIsClient } from "@/lib/useIsClient";
import { getActiveDatum } from "@/lib/chartUtils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card } from "@/components/Card";
import { RiSunLine } from "@remixicon/react";
import type { GenerationPoint } from "@/lib/types";
import { useI18n, formatNumber, type Locale } from "@/i18n";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: GenerationPoint }>;
  unitLabel: string;
  onActivePoint?: (point: GenerationPoint) => void;
  locale?: Locale;
}

export function GenerationTooltip({ active, payload, unitLabel, onActivePoint, locale = "pt-BR" }: CustomTooltipProps) {
  useEffect(() => {
    if (active && payload && payload.length > 0 && onActivePoint) {
      const point = payload[0]?.payload;
      if (point) {
        onActivePoint(point);
      }
    }
  }, [active, payload, onActivePoint]);

  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  return (
    <div className="hidden md:block rounded-lg border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{point.label}</p>
      <p className="mt-1 tabular-nums text-gray-500 dark:text-gray-400">
        {formatNumber(point.kwh, locale, { maximumFractionDigits: 1 })} {unitLabel}
      </p>
    </div>
  );
}

interface GenerationBarChartProps {
  data: GenerationPoint[];
  title: string;
  subtitle: string;
  unitLabel: string;
  color?: string;
}

export function GenerationBarChart({
  data,
  title,
  subtitle,
  unitLabel,
  color = "#f59e0b",
}: GenerationBarChartProps) {
  const { t, locale } = useI18n();
  const isMounted = useIsClient();
  const [inspectedPoint, setInspectedPoint] = useState<GenerationPoint | null>(null);
  const [chartKey, setChartKey] = useState(0);
  const isResettingRef = useRef(false);

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

  if (!data || data.length === 0) return null;

  const isDense = data.length > 15;
  const totalPeriodo = data.reduce((acc, d) => acc + d.kwh, 0);

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <RiSunLine className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>

        {/* Desktop Total Summary */}
        <div className="hidden sm:block text-right">
          <span className="text-xs text-gray-400">{t.combined.accumulatedTotal}</span>
          <p className="text-sm font-bold text-amber-500 tabular-nums">
            {formatNumber(totalPeriodo, locale, { maximumFractionDigits: 0 })} {unitLabel}
          </p>
        </div>
      </div>

      {/* MOBILE EXCLUSIVE INSPECTION PANEL (Sticky Header) */}
      <div className="block sm:hidden mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs transition-all">
        {inspectedPoint ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {title.toLowerCase().includes("mensal") || title.toLowerCase().includes("monthly")
                  ? t.combined.dayPrefix.replace("{label}", inspectedPoint.label)
                  : inspectedPoint.label.length === 4
                    ? t.combined.yearPrefix.replace("{label}", inspectedPoint.label)
                    : t.combined.monthPrefix.replace("{label}", inspectedPoint.label)}
              </span>
              <span className="text-xl font-extrabold text-amber-500 tabular-nums">
                {formatNumber(inspectedPoint.kwh, locale, { maximumFractionDigits: 1 })}
                <span className="ml-1 text-xs font-semibold text-amber-500/80">{unitLabel}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              onTouchEnd={handleReset}
              className="relative z-10 shrink-0 cursor-pointer rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 active:bg-amber-500/30 dark:text-amber-400"
            >
              {t.common.back}
            </button>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.combined.accumulatedTotal}</span>
            <span className="text-lg font-bold text-amber-500 tabular-nums">
              {formatNumber(totalPeriodo, locale, { maximumFractionDigits: 0 })}
              <span className="ml-1 text-xs font-medium text-amber-500/80">{unitLabel}</span>
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 md:mt-4 h-56 w-full">
        {!isMounted ? (
          <div className="size-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/40" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              key={chartKey}
              data={data}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              onClick={(state) => {
                if (isResettingRef.current) return;
                const point = getActiveDatum(state, data);
                if (point) setInspectedPoint(point);
              }}
            >
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={isDense ? 2 : 0}
                minTickGap={12}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <Tooltip
                content={<GenerationTooltip unitLabel={unitLabel} locale={locale} onActivePoint={setInspectedPoint} />}
                cursor={{ fill: "rgba(245,158,11,0.08)" }}
              />
              <Bar dataKey="kwh" fill={color} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
