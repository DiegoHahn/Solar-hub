import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { cx } from "@/lib/utils";
import { RiTempHotLine, RiFlashlightLine, RiSunLine, RiWifiLine } from "@remixicon/react";
import type { InverterReading } from "@/lib/types";

function getNominalKw(inverter: InverterReading): number {
  if (inverter.nominal_kw) return inverter.nominal_kw;
  if (inverter.id === "inv_1" || inverter.brand?.toLowerCase().includes("solis")) {
    return 6.0;
  }
  return 5.0;
}

interface InverterCardProps {
  inverter: InverterReading;
  /** Mostra detalhe das strings PV1/PV2 e Wi-Fi — usado na página Placas. */
  detailed?: boolean;
}

export function InverterCard({ inverter, detailed = false }: InverterCardProps) {
  const isOnline = inverter.status === "online";
  const nominalKw = getNominalKw(inverter);
  const nominalW = nominalKw * 1000;
  
  // Percentual real (pode ultrapassar 100% no pico do meio-dia, chegando a 110%-120%)
  const rawPct = nominalW > 0 ? Math.round((inverter.power_w / nominalW) * 100) : 0;
  const isOverload = rawPct > 100;
  const barFillWidth = Math.min(100, rawPct);

  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-800">
      {/* Glow suave no topo quando o inversor está em sobrecarga saudável / pico */}
      {isOverload && (
        <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-amber-500/15 blur-xl" />
      )}

      {/* Header: Nome + Marca + Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {inverter.name}
          </p>
          <Badge variant="neutral" className="text-[10px] px-1.5 py-0.5">
            {inverter.brand}
          </Badge>
        </div>

        <span className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          {isOnline ? (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
          ) : (
            <span className="size-2 rounded-full bg-gray-400 dark:bg-gray-600" />
          )}
          {isOnline ? "Online" : "Standby"}
        </span>
      </div>

      {/* Potência Instantânea */}
      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-bold tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
            {inverter.power_w.toLocaleString("pt-BR")}
          </span>
          <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400">W</span>
        </div>

        {/* Indicador de % da capacidade nominal */}
        <div className="text-right">
          {isOverload ? (
            <Badge variant="warning" className="text-[11px] font-semibold animate-pulse">
              ⚡ {rawPct}% (Pico)
            </Badge>
          ) : (
            <span className="text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">
              {rawPct}% de {nominalKw} kW
            </span>
          )}
        </div>
      </div>

      {/* Barra de Progresso da Capacidade Nominal */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={cx(
            "h-full rounded-full transition-all duration-500",
            !isOnline
              ? "bg-gray-400 dark:bg-gray-600"
              : isOverload
              ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 shadow-xs shadow-amber-500/50"
              : rawPct > 70
              ? "bg-gradient-to-r from-emerald-500 to-teal-400"
              : "bg-blue-500 dark:bg-blue-400"
          )}
          style={{ width: `${barFillWidth}%` }}
        />
      </div>

      {/* Micro Telemetria (Grid de métricas rápidas) */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 dark:border-gray-900 text-xs">
        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiSunLine className="size-3.5 text-amber-500" />
            Hoje
          </span>
          <p className="mt-0.5 font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {inverter.energy_today_kwh.toLocaleString("pt-BR")} <span className="font-normal text-[10px] text-gray-400">kWh</span>
          </p>
        </div>

        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiTempHotLine className="size-3.5 text-rose-500" />
            Temp
          </span>
          <p className="mt-0.5 font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {inverter.temperature_c ? `${inverter.temperature_c}°C` : "—"}
          </p>
        </div>

        <div>
          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <RiFlashlightLine className="size-3.5 text-blue-500" />
            Rede CA
          </span>
          <p className="mt-0.5 font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {inverter.vgrid ? `${Math.round(inverter.vgrid)}V` : "—"}
          </p>
        </div>
      </div>

      {detailed && (inverter.pv1 || inverter.pv2) && (
        <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Strings PV (CC)</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {inverter.pv1 && (
              <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-900/60">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">PV1</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {inverter.pv1.w.toLocaleString("pt-BR")} <span className="text-[11px] font-normal text-gray-400">W</span>
                </p>
                <p className="text-[11px] tabular-nums text-gray-400">
                  {inverter.pv1.v}V · {inverter.pv1.i}A
                </p>
              </div>
            )}
            {inverter.pv2 && (
              <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-900/60">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">PV2</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {inverter.pv2.w.toLocaleString("pt-BR")} <span className="text-[11px] font-normal text-gray-400">W</span>
                </p>
                <p className="text-[11px] tabular-nums text-gray-400">
                  {inverter.pv2.v}V · {inverter.pv2.i}A
                </p>
              </div>
            )}
          </div>
          {inverter.wifi_rssi && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <RiWifiLine className="size-3.5" />
              Sinal Wi-Fi: {inverter.wifi_rssi}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
