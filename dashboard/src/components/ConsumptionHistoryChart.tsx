"use client";

import { useIsClient } from "@/lib/useIsClient";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card } from "@/components/Card";
import { RiBarChartBoxLine } from "@remixicon/react";
import type { HistoricoConsumoMes } from "@/lib/types";
import { useI18n, formatNumber, formatCurrency, type Locale } from "@/i18n";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HistoricoConsumoMes }>;
  locale?: Locale;
}

function CustomTooltip({ active, payload, locale = "pt-BR" }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{point.mes}</p>
      <p className="mt-1 tabular-nums text-gray-500 dark:text-gray-400">
        {formatNumber(point.kwh, locale)} kWh
      </p>
      <p className="tabular-nums text-gray-500 dark:text-gray-400">
        {formatCurrency(point.valor, locale)}
      </p>
    </div>
  );
}

export function ConsumptionHistoryChart({ data }: { data: HistoricoConsumoMes[] }) {
  const { t, locale } = useI18n();
  const isMounted = useIsClient();

  if (!data || data.length === 0) return null;

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center gap-2">
        <RiBarChartBoxLine className="size-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t.utility.consumptionHistoryTitle}
        </h2>
      </div>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {t.utility.lastMonthsBilled.replace("{count}", String(data.length))}
      </p>

      <div className="mt-4 h-52 w-full">
        {!isMounted ? (
          <div className="size-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/40" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="mes"
                tickLine={false}
                axisLine={false}
                interval={3}
                minTickGap={16}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <Tooltip content={<CustomTooltip locale={locale} />} cursor={{ fill: "rgba(59,130,246,0.08)" }} />
              <Bar dataKey="kwh" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
