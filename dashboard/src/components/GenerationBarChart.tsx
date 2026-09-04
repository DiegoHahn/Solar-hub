"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card } from "@/components/Card";
import { RiSunLine } from "@remixicon/react";
import type { GenerationPoint } from "@/lib/types";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: GenerationPoint }>;
  unitLabel: string;
  onActivePoint?: (point: GenerationPoint) => void;
}

function CustomTooltip({ active, payload, unitLabel, onActivePoint }: CustomTooltipProps) {
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
        {point.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} {unitLabel}
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
  const [isMounted, setIsMounted] = useState(false);
  const [inspectedPoint, setInspectedPoint] = useState<GenerationPoint | null>(null);

  useEffect(() => setIsMounted(true), []);

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

        {/* Resumo do Total (Desktop) */}
        <div className="hidden sm:block text-right">
          <span className="text-xs text-gray-400">Total acumulado:</span>
          <p className="text-sm font-bold text-amber-500 tabular-nums">
            {totalPeriodo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} {unitLabel}
          </p>
        </div>
      </div>

      {/* PAINEL DE INSPEÇÃO EXCLUSIVO MOBILE (Sticky Header) */}
      <div className="block sm:hidden mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs transition-all">
        {inspectedPoint ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {title.includes("Mensal") ? `Dia ${inspectedPoint.label}:` : `Mês de ${inspectedPoint.label}:`}
              </span>
              <span className="text-xl font-extrabold text-amber-500 tabular-nums">
                {inspectedPoint.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                <span className="ml-1 text-xs font-semibold text-amber-500/80">{unitLabel}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setInspectedPoint(null)}
              className="shrink-0 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
            >
              ✕ Voltar
            </button>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total acumulado:</span>
            <span className="text-lg font-bold text-amber-500 tabular-nums">
              {totalPeriodo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
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
              data={data}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              onMouseMove={(e: any) => {
                if (e?.activePayload?.[0]?.payload) setInspectedPoint(e.activePayload[0].payload);
              }}
              onClick={(e: any) => {
                if (e?.activePayload?.[0]?.payload) setInspectedPoint(e.activePayload[0].payload);
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
                content={<CustomTooltip unitLabel={unitLabel} onActivePoint={setInspectedPoint} />}
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
