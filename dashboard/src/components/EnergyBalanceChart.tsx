"use client";

import { useEffect, useState, useMemo } from "react";
import { useIsClient } from "@/lib/useIsClient";
import { getActiveDatum } from "@/lib/chartUtils";
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
import { useI18n, formatNumber, type Locale } from "@/i18n";

interface EnergyBalanceChartProps {
  data: BalancoEnergeticoMes[];
  saldoAtual?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: BalancoEnergeticoMes }>;
  onActivePoint?: (point: BalancoEnergeticoMes) => void;
  locale?: Locale;
  surplusText?: string;
  deficitText?: string;
  injectedLabel?: string;
  gridLabel?: string;
  netLabel?: string;
  balanceLabel?: string;
}

export function EnergyBalanceTooltip({
  active,
  payload,
  onActivePoint,
  locale = "en",
  surplusText = "Surplus",
  deficitText = "Deficit",
  injectedLabel = "Injected to grid:",
  gridLabel = "Grid consumption:",
  netLabel = "Net Balance:",
  balanceLabel = "Accumulated GD Balance:",
}: CustomTooltipProps) {
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
          {isSuperavit ? surplusText : deficitText}
        </Badge>
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            {injectedLabel}
          </span>
          <span className="font-semibold tabular-nums">+{formatNumber(point.injetado_kwh, locale)} kWh</span>
        </div>

        <div className="flex items-center justify-between gap-4 text-blue-600 dark:text-blue-400">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-blue-500" />
            {gridLabel}
          </span>
          <span className="font-semibold tabular-nums">-{formatNumber(point.compensado_kwh, locale)} kWh</span>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-1 text-gray-700 dark:border-gray-800 dark:text-gray-200 font-medium">
          <span>{netLabel}</span>
          <span className={`tabular-nums ${isSuperavit ? "text-emerald-500" : "text-rose-500"}`}>
            {isSuperavit ? "+" : ""}
            {formatNumber(point.liquido_kwh, locale)} kWh
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 text-amber-500 pt-0.5">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" />
            {balanceLabel}
          </span>
          <span className="font-semibold tabular-nums">{formatNumber(point.saldo_kwh, locale)} kWh</span>
        </div>
      </div>
    </div>
  );
}

export function EnergyBalanceChart({ data: rawData, saldoAtual }: EnergyBalanceChartProps) {
  const { t, locale } = useI18n();
  const isMounted = useIsClient();
  const [viewMode, setViewMode] = useState<"comparison" | "net">("comparison");
  const [inspectedMonth, setInspectedMonth] = useState<BalancoEnergeticoMes | null>(null);

  // Remove trailing unbilled/empty months with all zeroes
  const data = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    const copy = [...rawData];
    while (
      copy.length > 1 &&
      copy[copy.length - 1].injetado_kwh === 0 &&
      copy[copy.length - 1].compensado_kwh === 0 &&
      copy[copy.length - 1].saldo_kwh === 0
    ) {
      copy.pop();
    }
    return copy;
  }, [rawData]);

  if (!data || data.length === 0) return null;

  // 12-month calculations
  const totalInjetado = data.reduce((acc, d) => acc + d.injetado_kwh, 0);
  const totalCompensado = data.reduce((acc, d) => acc + d.compensado_kwh, 0);
  const saldoLiquidoAno = totalInjetado - totalCompensado;
  const ultimoSaldo = saldoAtual !== undefined ? saldoAtual : (data[data.length - 1]?.saldo_kwh ?? 0);

  return (
    <Card className="p-4 md:p-6 space-y-4">
      {/* Header with Title and Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <RiScales3Line className="size-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t.utility.energyBalanceTitle}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t.utility.last12BilledMonths}
          </p>
        </div>

        {/* View mode toggle tabs */}
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
            {t.utility.injectionVsGrid}
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
            {t.utility.netTab}
          </button>
        </div>
      </div>

      {/* MOBILE EXCLUSIVE INSPECTION PANEL */}
      <div className="block sm:hidden rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5 text-xs transition-all">
        {inspectedMonth ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-sm text-gray-900 dark:text-gray-50">
                  {inspectedMonth.mes}:
                </span>
                <span className={`text-base font-extrabold tabular-nums ${inspectedMonth.liquido_kwh >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {inspectedMonth.liquido_kwh >= 0 ? "+" : ""}{formatNumber(inspectedMonth.liquido_kwh, locale)} kWh
                </span>
                <span className="text-[10px] text-gray-400">
                  ({inspectedMonth.liquido_kwh >= 0 ? t.utility.surplusWord : t.utility.deficitWord})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedMonth(null)}
                className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                {t.common.back}
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-emerald-500/15 pt-1.5 text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Injetado: <strong className="tabular-nums">+{formatNumber(inspectedMonth.injetado_kwh, locale)}</strong>
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                Rede: <strong className="tabular-nums">-{formatNumber(inspectedMonth.compensado_kwh, locale)}</strong>
              </span>
              <span className="text-amber-500 font-medium">
                Saldo: <strong className="tabular-nums">{formatNumber(inspectedMonth.saldo_kwh, locale)}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-200">
            <span className="text-gray-400">
              {t.utility.lastMonth.replace("{month}", data[data.length - 1]?.mes || "")}
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {t.utility.netKwh.replace("{kwh}", formatNumber(data[data.length - 1]?.liquido_kwh ?? 0, locale))}
            </span>
          </div>
        )}
      </div>

      {/* 12-Month Summary Mini Cards (Desktop) */}
      <div className="hidden sm:grid grid-cols-2 gap-2 sm:grid-cols-4 border-y border-gray-100 py-3 dark:border-gray-900 text-xs">
        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiArrowUpCircleLine className="size-3.5 text-emerald-500" />
            {t.utility.totalInjected12m}
          </span>
          <p className="mt-0.5 font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            +{formatNumber(totalInjetado, locale)} <span className="font-normal text-[10px] text-gray-400">kWh</span>
          </p>
        </div>

        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiArrowDownCircleLine className="size-3.5 text-blue-500" />
            {t.utility.gridConsumption12m}
          </span>
          <p className="mt-0.5 font-bold tabular-nums text-blue-600 dark:text-blue-400">
            -{formatNumber(totalCompensado, locale)} <span className="font-normal text-[10px] text-gray-400">kWh</span>
          </p>
        </div>

        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiScales3Line className="size-3.5 text-indigo-500" />
            {t.utility.netSurplus}
          </span>
          <p className="mt-0.5 font-bold tabular-nums text-gray-900 dark:text-gray-100">
            +{formatNumber(saldoLiquidoAno, locale)} <span className="font-normal text-[10px] text-gray-400">kWh</span>
          </p>
        </div>

        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiWallet3Line className="size-3.5 text-amber-500" />
            {t.utility.currentBalanceLabel}
          </span>
          <p className="mt-0.5 font-bold tabular-nums text-amber-500">
            {formatNumber(ultimoSaldo, locale)} <span className="font-normal text-[10px] text-gray-400">kWh</span>
          </p>
        </div>
      </div>

      {/* Recharts Chart */}
      <div className="h-60 w-full">
        {!isMounted ? (
          <div className="size-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/40" />
        ) : viewMode === "comparison" ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onMouseMove={(state) => {
                const month = getActiveDatum(state, data);
                if (month) setInspectedMonth(month);
              }}
              onClick={(state) => {
                const month = getActiveDatum(state, data);
                if (month) setInspectedMonth(month);
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
              <Tooltip
                content={
                  <EnergyBalanceTooltip
                    locale={locale}
                    surplusText={t.utility.surplus}
                    deficitText={t.utility.deficit}
                    injectedLabel={t.utility.injectedToGrid}
                    gridLabel={t.utility.gridConsumption}
                    netLabel={t.utility.netBalance}
                    balanceLabel={t.utility.accumulatedGdBalance}
                    onActivePoint={setInspectedMonth}
                  />
                }
              />
              <Legend
                verticalAlign="bottom"
                height={28}
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              />
              <Bar
                yAxisId="left"
                dataKey="injetado_kwh"
                name={t.utility.solarInjectionLegend}
                fill="#10b981"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="compensado_kwh"
                name={t.utility.gridConsumptionLegend}
                fill="#3b82f6"
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="saldo_kwh"
                name={t.utility.gdBalanceLegend}
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
              onMouseMove={(state) => {
                const month = getActiveDatum(state, data);
                if (month) setInspectedMonth(month);
              }}
              onClick={(state) => {
                const month = getActiveDatum(state, data);
                if (month) setInspectedMonth(month);
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
              <Tooltip
                content={
                  <EnergyBalanceTooltip
                    locale={locale}
                    surplusText={t.utility.surplus}
                    deficitText={t.utility.deficit}
                    injectedLabel={t.utility.injectedToGrid}
                    gridLabel={t.utility.gridConsumption}
                    netLabel={t.utility.netBalance}
                    balanceLabel={t.utility.accumulatedGdBalance}
                    onActivePoint={setInspectedMonth}
                  />
                }
              />
              <Bar dataKey="liquido_kwh" name={t.utility.netBalanceKwhLegend} radius={[3, 3, 0, 0]}>
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
        <span>{t.utility.balanceFooterNote}</span>
        <span className="font-medium text-amber-500">
          {t.utility.currentBalanceFooter.replace("{balance}", formatNumber(ultimoSaldo, locale))}
        </span>
      </div>
    </Card>
  );
}
