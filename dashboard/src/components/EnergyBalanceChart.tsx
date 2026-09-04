"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { RiScales3Line, RiArrowUpCircleLine, RiArrowDownCircleLine, RiWallet3Line } from "@remixicon/react";
import type { BalancoEnergeticoMes } from "@/lib/types";

interface EnergyBalanceChartProps {
  data: BalancoEnergeticoMes[];
}

function CustomTooltip({ active, payload, label, onActivePoint }: any) {
  useEffect(() => {
    if (active && payload && payload.length > 0 && onActivePoint) {
      const point = payload[0]?.payload as BalancoEnergeticoMes | undefined;
      if (point) {
        onActivePoint(point);
      }
    }
  }, [active, payload, onActivePoint]);

  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload as BalancoEnergeticoMes;
  if (!point) return null;

  const isSuperavit = point.liquido_kwh >= 0;

  return (
    <div className="hidden md:block rounded-lg border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 text-xs">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-1.5 dark:border-gray-800">
        <span className="font-semibold text-gray-900 dark:text-gray-100">{point.mes}</span>
        <Badge variant={isSuperavit ? "success" : "error"} className="text-[10px] px-1.5 py-0.5">
          {isSuperavit ? "Superávit" : "Déficit"}
        </Badge>
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            Injetado na rede:
          </span>
          <span className="font-semibold tabular-nums">+{point.injetado_kwh.toLocaleString("pt-BR")} kWh</span>
        </div>

        <div className="flex items-center justify-between gap-4 text-blue-600 dark:text-blue-400">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-blue-500" />
            Consumo da rede:
          </span>
          <span className="font-semibold tabular-nums">-{point.compensado_kwh.toLocaleString("pt-BR")} kWh</span>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-1 text-gray-700 dark:border-gray-800 dark:text-gray-200 font-medium">
          <span>Balanço Líquido:</span>
          <span className={`tabular-nums ${isSuperavit ? "text-emerald-500" : "text-rose-500"}`}>
            {isSuperavit ? "+" : ""}
            {point.liquido_kwh.toLocaleString("pt-BR")} kWh
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 text-amber-500 pt-0.5">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" />
            Saldo Acumulado GD:
          </span>
          <span className="font-semibold tabular-nums">{point.saldo_kwh.toLocaleString("pt-BR")} kWh</span>
        </div>
      </div>
    </div>
  );
}

export function EnergyBalanceChart({ data }: EnergyBalanceChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<"comparison" | "net">("comparison");
  const [inspectedMonth, setInspectedMonth] = useState<BalancoEnergeticoMes | null>(null);

  useEffect(() => setIsMounted(true), []);

  if (!data || data.length === 0) return null;

  // Cálculos do período de 12 meses
  const totalInjetado = data.reduce((acc, d) => acc + d.injetado_kwh, 0);
  const totalCompensado = data.reduce((acc, d) => acc + d.compensado_kwh, 0);
  const saldoLiquidoAno = totalInjetado - totalCompensado;
  const ultimoSaldo = data[data.length - 1]?.saldo_kwh ?? 0;

  return (
    <Card className="p-4 md:p-6 space-y-4">
      {/* Cabeçalho com Título e Switch de visualização */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <RiScales3Line className="size-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Balanço Energético
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Últimos 12 meses faturados (Cooperaliança)
          </p>
        </div>

        {/* Abas para alternar visualização */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900 self-start sm:self-auto text-xs">
          <button
            type="button"
            onClick={() => setViewMode("comparison")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === "comparison"
                ? "bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-gray-50"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
          >
            Injeção vs Rede
          </button>
          <button
            type="button"
            onClick={() => setViewMode("net")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === "net"
                ? "bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-gray-50"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
          >
            Líquido (±)
          </button>
        </div>
      </div>

      {/* PAINEL DE INSPEÇÃO EXCLUSIVO MOBILE (Super Compacto) */}
      <div className="block sm:hidden rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5 text-xs transition-all">
        {inspectedMonth ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-sm text-gray-900 dark:text-gray-50">
                  {inspectedMonth.mes}:
                </span>
                <span className={`text-base font-extrabold tabular-nums ${inspectedMonth.liquido_kwh >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {inspectedMonth.liquido_kwh >= 0 ? "+" : ""}{inspectedMonth.liquido_kwh.toLocaleString("pt-BR")} kWh
                </span>
                <span className="text-[10px] text-gray-400">
                  ({inspectedMonth.liquido_kwh >= 0 ? "sobra" : "déficit"})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedMonth(null)}
                className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                ✕ Voltar
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-emerald-500/15 pt-1.5 text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Injetado: <strong className="tabular-nums">+{inspectedMonth.injetado_kwh.toLocaleString("pt-BR")}</strong>
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                Rede: <strong className="tabular-nums">-{inspectedMonth.compensado_kwh.toLocaleString("pt-BR")}</strong>
              </span>
              <span className="text-amber-500 font-medium">
                Saldo: <strong className="tabular-nums">{inspectedMonth.saldo_kwh.toLocaleString("pt-BR")}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-200">
            <span className="text-gray-400">Último mês ({data[data.length - 1]?.mes}):</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{data[data.length - 1]?.liquido_kwh.toLocaleString("pt-BR")} kWh líquido
            </span>
          </div>
        )}
      </div>

      {/* Mini Cards de Resumo dos 12 Meses (Visível no Desktop) */}
      <div className="hidden sm:grid grid-cols-2 gap-2 sm:grid-cols-4 border-y border-gray-100 py-3 dark:border-gray-900 text-xs">
        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiArrowUpCircleLine className="size-3.5 text-emerald-500" />
            Total Injetado (12m)
          </span>
          <p className="mt-0.5 font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            +{totalInjetado.toLocaleString("pt-BR")} <span className="font-normal text-[10px] text-gray-400">kWh</span>
          </p>
        </div>

        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiArrowDownCircleLine className="size-3.5 text-blue-500" />
            Consumo da Rede (12m)
          </span>
          <p className="mt-0.5 font-bold tabular-nums text-blue-600 dark:text-blue-400">
            -{totalCompensado.toLocaleString("pt-BR")} <span className="font-normal text-[10px] text-gray-400">kWh</span>
          </p>
        </div>

        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiScales3Line className="size-3.5 text-indigo-500" />
            Superávit Líquido
          </span>
          <p className="mt-0.5 font-bold tabular-nums text-gray-900 dark:text-gray-100">
            +{saldoLiquidoAno.toLocaleString("pt-BR")} <span className="font-normal text-[10px] text-gray-400">kWh</span>
          </p>
        </div>

        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiWallet3Line className="size-3.5 text-amber-500" />
            Saldo Atual GD
          </span>
          <p className="mt-0.5 font-bold tabular-nums text-amber-500">
            {ultimoSaldo.toLocaleString("pt-BR")} <span className="font-normal text-[10px] text-gray-400">kWh</span>
          </p>
        </div>
      </div>

      {/* Gráfico Recharts */}
      <div className="h-60 w-full">
        {!isMounted ? (
          <div className="size-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/40" />
        ) : viewMode === "comparison" ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onMouseMove={(e: any) => {
                if (e?.activePayload?.[0]?.payload) setInspectedMonth(e.activePayload[0].payload);
              }}
              onClick={(e: any) => {
                if (e?.activePayload?.[0]?.payload) setInspectedMonth(e.activePayload[0].payload);
              }}
            >
              <XAxis
                dataKey="mes"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
              />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => `${v}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 10000]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#f59e0b" }}
                tickFormatter={(v) => `${v / 1000}k`}
              />
              <Tooltip content={<CustomTooltip onActivePoint={setInspectedMonth} />} />
              <Legend
                verticalAlign="bottom"
                height={28}
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              />
              <Bar
                yAxisId="left"
                dataKey="injetado_kwh"
                name="Injeção Solar"
                fill="#10b981"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="compensado_kwh"
                name="Consumo Rede"
                fill="#3b82f6"
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="saldo_kwh"
                name="Saldo GD"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#f59e0b" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onMouseMove={(e: any) => {
                if (e?.activePayload?.[0]?.payload) setInspectedMonth(e.activePayload[0].payload);
              }}
              onClick={(e: any) => {
                if (e?.activePayload?.[0]?.payload) setInspectedMonth(e.activePayload[0].payload);
              }}
            >
              <XAxis
                dataKey="mes"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => `${v}`}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
              <Tooltip content={<CustomTooltip onActivePoint={setInspectedMonth} />} />
              <Bar dataKey="liquido_kwh" name="Balanço Líquido (kWh)" radius={[3, 3, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.liquido_kwh >= 0 ? "#10b981" : "#f43f5e"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="hidden sm:flex flex-wrap items-center justify-between border-t border-gray-100 pt-2.5 dark:border-gray-900 text-[11px] text-gray-500 dark:text-gray-400">
        <span>💡 Injeção &gt; Consumo = Créditos solares gerados para o saldo acumulado</span>
        <span className="font-medium text-amber-500">Saldo atual: {ultimoSaldo.toLocaleString("pt-BR")} kWh</span>
      </div>
    </Card>
  );
}
