import Link from "next/link";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import {
  RiFlashlightLine,
  RiArrowRightUpLine,
  RiSunLine,
  RiTempHotLine,
  RiShieldFlashLine,
} from "@remixicon/react";
import { cx } from "@/lib/utils";
import type { InverterReading } from "@/lib/types";
import { getNominalKw } from "@/lib/inverter";

interface InvertersGroupCardProps {
  inverters: InverterReading[];
}

export function InvertersGroupCard({ inverters }: InvertersGroupCardProps) {
  const onlineCount = inverters.filter((inv) => inv.status === "online").length;
  const totalPowerW = inverters.reduce((acc, inv) => acc + (inv.power_w || 0), 0);
  const totalNominalW = inverters.reduce((acc, inv) => acc + getNominalKw(inv) * 1000, 0);
  const totalPct = totalNominalW > 0 ? Math.round((totalPowerW / totalNominalW) * 100) : 0;

  return (
    <Card className="p-4 sm:p-5">
      {/* Cabeçalho Unificado */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-3.5 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <RiFlashlightLine className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900 sm:text-base dark:text-gray-100">
                Parque de Inversores
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {onlineCount} de {inverters.length} online
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Potência combinada: <strong className="text-gray-800 dark:text-gray-200">{totalPowerW.toLocaleString("pt-BR")} W</strong> ({totalPct}% de {totalNominalW / 1000} kW nominal)
            </p>
          </div>
        </div>

        {/* Link para a página detalhada de Placas */}
        <Link
          href="/placas"
          className="inline-flex self-start sm:self-auto items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          Ver strings PV & histórico
          <RiArrowRightUpLine className="size-3.5" />
        </Link>
      </div>

      {/* Grid com os 3 Inversores Compactados */}
      <div className="mt-3.5 grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-3 sm:divide-y-0 sm:divide-x sm:divide-gray-100 dark:divide-gray-800">
        {inverters.map((inv, idx) => {
          const nominalKw = getNominalKw(inv);
          const nominalW = nominalKw * 1000;
          const rawPct = nominalW > 0 ? Math.round((inv.power_w / nominalW) * 100) : 0;
          const isOverload = rawPct > 100;
          const isOnline = inv.status === "online";

          return (
            <div
              key={inv.id}
              className={cx(
                "py-3 sm:py-0 flex flex-col justify-between",
                idx === 0 ? "sm:pr-4" : idx === inverters.length - 1 ? "sm:pl-4" : "sm:px-4"
              )}
            >
              {/* Header do Inversor */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate text-xs font-bold text-gray-900 dark:text-gray-200">
                    {inv.name}
                  </span>
                  <Badge variant="neutral" className="text-[10px] px-1 py-0 h-4">
                    {inv.brand}
                  </Badge>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
                  <span
                    className={cx(
                      "size-1.5 rounded-full",
                      isOnline ? "bg-emerald-500" : "bg-gray-400"
                    )}
                  />
                  {isOnline ? "Ativo" : "Standby"}
                </span>
              </div>

              {/* Potência Instantânea */}
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-xl font-extrabold tabular-nums text-gray-900 dark:text-gray-50">
                    {inv.power_w.toLocaleString("pt-BR")}
                  </span>
                  <span className="ml-1 text-xs font-semibold text-gray-500 dark:text-gray-400">W</span>
                </div>
                <span
                  className={cx(
                    "text-xs font-bold tabular-nums",
                    isOverload
                      ? "text-amber-500 font-extrabold"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {rawPct}% de {nominalKw} kW
                </span>
              </div>

              {/* Mini Barra de Progresso */}
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={cx(
                    "h-full rounded-full transition-all duration-300",
                    isOverload
                      ? "bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500"
                      : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(100, rawPct)}%` }}
                />
              </div>

              {/* Mini Estatísticas Rápidas (3 métricas em linha) */}
              <div className="mt-3 flex items-center justify-between gap-1 rounded-lg bg-gray-50/70 px-2.5 py-1.5 text-[11px] dark:bg-gray-900/60">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                  <RiSunLine className="size-3 text-amber-500" />
                  <span className="font-semibold">{inv.energy_today_kwh.toFixed(1)} kWh</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                  <RiTempHotLine className="size-3 text-red-400" />
                  <span>{inv.temperature_c ? `${inv.temperature_c.toFixed(1)}°C` : "--"}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                  <RiShieldFlashLine className="size-3 text-blue-500" />
                  <span>{inv.vgrid ? `${Math.round(inv.vgrid)}V` : "--"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
