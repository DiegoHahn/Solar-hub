"use client";

import { useEffect, useState, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Card } from "@/components/Card";
import { RiBarChartGroupedLine } from "@remixicon/react";
import type { SunCurvePoint } from "@/lib/types";

const SERIES = [
  { key: "solis_kw", label: "Solis 6kW", color: "#3b82f6" },
  { key: "goodwe1_kw", label: "GoodWe #1 (5kW)", color: "#10b981" },
  { key: "goodwe2_kw", label: "GoodWe #2 (5kW)", color: "#8b5cf6" },
] as const;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; payload: SunCurvePoint }>;
  label?: string;
  onActivePoint?: (point: SunCurvePoint) => void;
}

function CustomTooltip({ active, payload, label, onActivePoint }: CustomTooltipProps) {
  useEffect(() => {
    if (active && payload && payload.length > 0 && onActivePoint) {
      const point = payload[0]?.payload;
      if (point) {
        onActivePoint(point);
      }
    }
  }, [active, payload, onActivePoint]);

  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);

  return (
    <div className="hidden md:block rounded-lg border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 text-xs">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5 font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
        <span>{label}</span>
        <span className="tabular-nums">{total.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kW</span>
      </div>
      <div className="mt-2 space-y-1">
        {payload.map((p) => {
          const series = SERIES.find((s) => s.key === p.dataKey);
          if (!series) return null;
          return (
            <div key={p.dataKey} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <span className="size-2 rounded-full" style={{ backgroundColor: series.color }} />
                {series.label}
              </span>
              <span className="tabular-nums text-gray-700 dark:text-gray-200">
                {p.value.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kW
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InverterCurveChart({ data }: { data: SunCurvePoint[] }) {
  const [isMounted, setIsMounted] = useState(false);
  const [inspectedPoint, setInspectedPoint] = useState<SunCurvePoint | null>(null);
  const [chartKey, setChartKey] = useState(0);
  const isResettingRef = useRef(false);

  useEffect(() => setIsMounted(true), []);

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

  // Ponto de pico do dia (usado como referência padrão para nunca ficar vazio)
  const peakPoint = data.reduce(
    (max, p) => (p.power_kw > max.power_kw ? p : max),
    data[0] || { power_kw: 0, time: "--:--" }
  );

  const displayPoint = inspectedPoint || peakPoint;
  const isInspecting = inspectedPoint !== null;

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center gap-2">
        <RiBarChartGroupedLine className="size-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Contribuição por Inversor
        </h2>
      </div>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Potência individual em tempo real de cada inversor ao longo do dia
      </p>

      {/* PAINEL DE INSPEÇÃO EXCLUSIVO MOBILE (Sticky Header - Sempre com dados reais) */}
      <div className="block sm:hidden mt-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3 text-xs transition-all">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Horário {displayPoint.time}:
              </span>
              <span className="text-xl font-extrabold text-blue-500 tabular-nums">
                {displayPoint.power_kw.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                <span className="ml-1 text-xs font-semibold text-blue-500/80">kW total</span>
              </span>
              {!isInspecting && (
                <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  Pico
                </span>
              )}
            </div>
            {isInspecting && (
              <button
                type="button"
                onClick={handleReset}
                onTouchEnd={handleReset}
                className="relative z-10 shrink-0 cursor-pointer rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500/20 active:bg-blue-500/30 dark:text-blue-400"
              >
                ✕ Voltar
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-500/15 text-xs">
            <div>
              <span className="text-[#3b82f6] font-medium">Solis 6kW:</span>{" "}
              <strong className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{displayPoint.solis_kw?.toFixed(1) ?? "0"} kW</strong>
            </div>
            <div>
              <span className="text-[#10b981] font-medium">GoodWe 1:</span>{" "}
              <strong className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{displayPoint.goodwe1_kw?.toFixed(1) ?? "0"} kW</strong>
            </div>
            <div>
              <span className="text-[#8b5cf6] font-medium">GoodWe 2:</span>{" "}
              <strong className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{displayPoint.goodwe2_kw?.toFixed(1) ?? "0"} kW</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 md:mt-4 h-64 w-full">
        {!isMounted ? (
          <div className="size-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/40" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              key={chartKey}
              data={data}
              margin={{ top: 12, right: 8, left: -20, bottom: 0 }}
              onClick={(e: any) => {
                if (isResettingRef.current) return;
                if (e?.activePayload?.[0]?.payload) setInspectedPoint(e.activePayload[0].payload);
              }}
            >
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>

              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                ticks={[
                  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00",
                  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
                  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
                  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
                ]}
                tickFormatter={(val: string) => val ? val.slice(0, 5) : ""}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={[0, (dataMax: number) => Math.max(6.5, Math.ceil(dataMax + 0.5))]}
                tickFormatter={(val) => `${val} kW`}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />
              <Tooltip content={<CustomTooltip onActivePoint={setInspectedPoint} />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) => SERIES.find((s) => s.key === value)?.label ?? value}
              />

              {SERIES.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#grad-${s.key})`}
                  animationDuration={900}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
