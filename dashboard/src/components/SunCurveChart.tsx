"use client";

import { useEffect, useState, useRef } from "react";
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

interface SunCurveChartProps {
  data: SunCurvePoint[];
  nominalCapKw?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  nominalCapKw: number;
  onActivePoint?: (point: SunCurvePoint) => void;
  canUpdate?: boolean;
}

function CustomTooltip({ active, payload, label, nominalCapKw, onActivePoint, canUpdate = true }: CustomTooltipProps) {
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
  const pct = Math.round((point.power_kw / nominalCapKw) * 100);
  const isOver = pct > 100;

  return (
    <div className="hidden md:block rounded-lg border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 text-xs">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-1.5 dark:border-gray-800">
        <span className="font-semibold text-gray-900 dark:text-gray-100">{label}</span>
        <Badge variant={isOver ? "warning" : "neutral"} className="text-[10px] px-1.5 py-0.5">
          {pct}% da usina
        </Badge>
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-4 font-semibold text-amber-500">
          <span>Potência Total:</span>
          <span className="tabular-nums">{point.power_kw.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kW</span>
        </div>

        {point.solis_kw !== undefined && (
          <div className="flex items-center justify-between gap-4 text-gray-500 dark:text-gray-400">
            <span>Solis 6kW:</span>
            <span className="tabular-nums">{point.solis_kw.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kW</span>
          </div>
        )}

        {point.goodwe1_kw !== undefined && (
          <div className="flex items-center justify-between gap-4 text-gray-500 dark:text-gray-400">
            <span>GoodWe #1 (5kW):</span>
            <span className="tabular-nums">{point.goodwe1_kw.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kW</span>
          </div>
        )}

        {point.goodwe2_kw !== undefined && (
          <div className="flex items-center justify-between gap-4 text-gray-500 dark:text-gray-400">
            <span>GoodWe #2 (5kW):</span>
            <span className="tabular-nums">{point.goodwe2_kw.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kW</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SunCurveChart({ data, nominalCapKw = 16.0 }: SunCurveChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [inspectedPoint, setInspectedPoint] = useState<SunCurvePoint | null>(null);
  const [canUpdate, setCanUpdate] = useState(true);
  const resetCooldownRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleReset = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resetCooldownRef.current = true;
    setCanUpdate(false);
    setInspectedPoint(null);
    setTimeout(() => {
      resetCooldownRef.current = false;
      setCanUpdate(true);
    }, 400);
  };

  if (!data || data.length === 0) {
    return null;
  }

  // Encontra o pico de potência do dia
  const peakPoint = data.reduce(
    (max, p) => (p.power_kw > max.power_kw ? p : max),
    data[0] || { power_kw: 0, time: "--:--" }
  );
  const peakPct = Math.round((peakPoint.power_kw / nominalCapKw) * 100);
  const isPeakOverload = peakPct > 100;

  const displayPoint = inspectedPoint || peakPoint;
  const isInspecting = inspectedPoint !== null;

  return (
    <Card className="relative overflow-hidden p-4 md:p-6">
      {/* Header do Gráfico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <RiSunLine className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Curva Solar de Hoje
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Geração ao longo do dia em tempo real (intervalos de 30 min)
          </p>
        </div>

        {/* Badge de Pico do Dia (Visível no Desktop) */}
        <div className="hidden sm:flex items-center gap-2">
          <Badge
            variant={isPeakOverload ? "warning" : "default"}
            className="flex items-center gap-1 text-xs py-1 px-2.5"
          >
            <RiFlashlightLine className="size-3.5" />
            Pico: <span className="font-bold">{peakPoint.power_kw.toLocaleString("pt-BR")} kW</span> às {peakPoint.time} ({peakPct}%)
          </Badge>
        </div>
      </div>

      {/* PAINEL DE INSPEÇÃO EXCLUSIVO MOBILE (Sticky Header - Sempre com dados reais) */}
      <div className="block sm:hidden mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs transition-all">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Horário {displayPoint.time}:
              </span>
              <span className="text-xl font-extrabold text-amber-500 tabular-nums">
                {displayPoint.power_kw.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                <span className="ml-1 text-xs font-semibold text-amber-500/80">kW</span>
              </span>
              <Badge
                variant={Math.round((displayPoint.power_kw / nominalCapKw) * 100) > 100 ? "warning" : "neutral"}
                className="text-[10px] px-1.5 py-0"
              >
                {Math.round((displayPoint.power_kw / nominalCapKw) * 100)}% pico
              </Badge>
            </div>
            {isInspecting && (
              <button
                type="button"
                onClick={handleReset}
                onTouchEnd={handleReset}
                className="relative z-10 shrink-0 cursor-pointer rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 active:bg-amber-500/30 dark:text-amber-400"
              >
                ✕ Voltar
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

      {/* Gráfico Recharts */}
      <div className="mt-3 md:mt-4 h-52 w-full">
        {!isMounted ? (
          <div className="size-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/40" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 12, right: 8, left: -20, bottom: 0 }}
              onMouseMove={(e: any) => {
                if (resetCooldownRef.current) return;
                if (e?.activePayload?.[0]?.payload) setInspectedPoint(e.activePayload[0].payload);
              }}
              onClick={(e: any) => {
                if (resetCooldownRef.current) return;
                if (e?.activePayload?.[0]?.payload) setInspectedPoint(e.activePayload[0].payload);
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
                domain={[0, (dataMax: number) => Math.max(nominalCapKw + 1.5, Math.ceil(dataMax + 0.5))]}
                tickFormatter={(val) => `${val}k`}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />

              <Tooltip
                content={
                  <CustomTooltip
                    nominalCapKw={nominalCapKw}
                    onActivePoint={setInspectedPoint}
                    canUpdate={canUpdate}
                  />
                }
                cursor={{ stroke: "#f59e0b", strokeWidth: 1, strokeDasharray: "3 3" }}
              />

              {/* Linha de referência da capacidade nominal de 16 kW */}
              <ReferenceLine
                y={nominalCapKw}
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{
                  value: `Nominal ${nominalCapKw} kW`,
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
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legenda inferior */}
      <div className="mt-3 flex flex-wrap items-center justify-between border-t border-gray-100 pt-2.5 dark:border-gray-900 text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500" />
          <span>Geração Real</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 border-t-2 border-dashed border-slate-400" />
          <span>Capacidade Homologada (16.0 kWp)</span>
        </div>
      </div>
    </Card>
  );
}
