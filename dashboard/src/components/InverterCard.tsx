"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { cx } from "@/lib/utils";
import {
  RiTempHotLine,
  RiFlashlightLine,
  RiSunLine,
  RiWifiLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCpuLine,
  RiShieldCheckLine,
  RiTimeLine,
  RiPulseLine,
  RiPercentLine,
} from "@remixicon/react";
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
  /** Mostra detalhe das strings PV1/PV2 e telemetria avançada — usado na página Placas. */
  detailed?: boolean;
}

export function InverterCard({ inverter, detailed = false }: InverterCardProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isOnline = inverter.status === "online";
  const nominalKw = getNominalKw(inverter);
  const nominalW = nominalKw * 1000;

  // Percentual real de carga nominal
  const rawPct = nominalW > 0 ? Math.round((inverter.power_w / nominalW) * 100) : 0;
  const isOverload = rawPct > 100;
  const barFillWidth = Math.min(100, rawPct);

  // Extração de sensores aprofundados dos GoodWe (via raw_sensors) e Solis (via raw_variables)
  const raw = inverter.raw_sensors || {};
  const rawVars = inverter.raw_variables || {};

  const heatsinkTemp: number | null = raw.temperature_heatsink ?? null;
  const powerFactor: number | null = raw.power_factor ?? null;
  const apparentPower: number | null = raw.apparent_power ?? null;
  const reactivePower: number | null = raw.reactive_power ?? null;
  const hoursTotal: number | null = raw.h_total ?? null;
  const leakageCurrent: number | null = raw.leakage_current ?? null;
  const vbus: number | null = raw.vbus ?? null;
  const workMode: string = inverter.work_mode || raw.work_mode_label || "Normal";

  const modelName =
    inverter.model ||
    raw.model ||
    (inverter.brand?.toLowerCase().includes("solis") ? "Solis 6kW Mini/4G" : "GW5000-DNS-30");

  const serialNum =
    inverter.serial ||
    inverter.inverter_sn ||
    rawVars.webdata_sn?.trim() ||
    "—";

  const firmwareVer =
    inverter.firmware ||
    inverter.logger_ver ||
    rawVars.cover_ver ||
    "—";

  const wifiSsid = inverter.wifi_ssid || rawVars.cover_sta_ssid || null;
  const wifiRssi = inverter.wifi_rssi || rawVars.cover_sta_rssi || null;

  // Cálculo de potência CC total das strings deste inversor
  const pv1W = inverter.pv1?.w ?? 0;
  const pv2W = inverter.pv2?.w ?? 0;
  const totalDcW = pv1W + pv2W;
  const efficiencyPct = totalDcW > 0 ? Math.min(99.5, Math.round((inverter.power_w / totalDcW) * 1000) / 10) : null;

  return (
    <Card className="relative flex flex-col justify-between overflow-hidden transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-800">
      {/* Glow suave no topo quando o inversor está no pico */}
      {isOverload && (
        <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-amber-500/15 blur-xl" />
      )}

      <div>
        {/* Header: Nome + Marca + Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {inverter.name}
            </p>
            <Badge variant="neutral" className="px-1.5 py-0.5 text-[10px]">
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
              <Badge variant="warning" className="animate-pulse text-[11px] font-semibold">
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
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-900">
          <div>
            <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
              <RiSunLine className="size-3.5 text-amber-500" />
              Hoje
            </span>
            <p className="mt-0.5 font-semibold tabular-nums text-gray-700 dark:text-gray-200">
              {inverter.energy_today_kwh.toLocaleString("pt-BR")}{" "}
              <span className="text-[10px] font-normal text-gray-400">kWh</span>
            </p>
          </div>

          <div>
            <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
              <RiTempHotLine className="size-3.5 text-rose-500" />
              Temp
            </span>
            <p className="mt-0.5 font-semibold tabular-nums text-gray-700 dark:text-gray-200">
              {inverter.temperature_c ? `${inverter.temperature_c.toFixed(1)}°C` : "—"}
            </p>
          </div>

          <div>
            <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
              <RiFlashlightLine className="size-3.5 text-blue-500" />
              Rede CA
            </span>
            <p className="mt-0.5 font-semibold tabular-nums text-gray-700 dark:text-gray-200">
              {inverter.vgrid ? `${Math.round(inverter.vgrid)}V` : "—"}{" "}
              {inverter.igrid && (
                <span className="text-[10px] font-normal text-gray-400">
                  · {inverter.igrid.toFixed(1)}A
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Strings PV (CC) */}
        {detailed && (inverter.pv1 || inverter.pv2) && (
          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-900">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-500 dark:text-gray-400">Strings PV (CC)</span>
              {efficiencyPct && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  η {efficiencyPct}% CC➔CA
                </span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {inverter.pv1 && (
                <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-900/60">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">PV1</p>
                    <span className="text-[10px] text-gray-400">
                      {totalDcW > 0 ? `${Math.round((pv1W / totalDcW) * 100)}%` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {inverter.pv1.w.toLocaleString("pt-BR")}{" "}
                    <span className="text-[11px] font-normal text-gray-400">W</span>
                  </p>
                  <p className="text-[11px] tabular-nums text-gray-400">
                    {inverter.pv1.v}V · {inverter.pv1.i}A
                  </p>
                </div>
              )}

              {inverter.pv2 && (
                <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-900/60">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">PV2</p>
                    <span className="text-[10px] text-gray-400">
                      {totalDcW > 0 ? `${Math.round((pv2W / totalDcW) * 100)}%` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {inverter.pv2.w.toLocaleString("pt-BR")}{" "}
                    <span className="text-[11px] font-normal text-gray-400">W</span>
                  </p>
                  <p className="text-[11px] tabular-nums text-gray-400">
                    {inverter.pv2.v}V · {inverter.pv2.i}A
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Diagnóstico Avançado (Expansível) */}
        {detailed && (
          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-900">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between text-left text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <RiCpuLine className="size-3.5 text-indigo-500" />
                Diagnóstico & Telemetria Modbus
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                {showAdvanced ? "Ocultar" : "Expandir"}
                {showAdvanced ? (
                  <RiArrowUpSLine className="size-4" />
                ) : (
                  <RiArrowDownSLine className="size-4" />
                )}
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-lg bg-gray-50/80 p-3 text-xs dark:bg-gray-900/80">
                {/* 1. Gestão Térmica */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Sensores Térmicos
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-white p-2 dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400">Circuito Interno</span>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {inverter.temperature_c ? `${inverter.temperature_c.toFixed(1)}°C` : "—"}
                      </p>
                    </div>
                    <div className="rounded-md bg-white p-2 dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400">Dissipador Externo</span>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {heatsinkTemp ? `${heatsinkTemp.toFixed(1)}°C` : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Qualidade da Rede CA */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Rede Elétrica (Cooperaliança)
                  </p>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    <div className="rounded-md bg-white p-1.5 text-center dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400">Freq. CA</span>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {inverter.fgrid ? `${inverter.fgrid.toFixed(1)} Hz` : "60.0 Hz"}
                      </p>
                    </div>
                    <div className="rounded-md bg-white p-1.5 text-center dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400">Fator Pot.</span>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {powerFactor ? powerFactor.toFixed(3) : "1.000"}
                      </p>
                    </div>
                    <div className="rounded-md bg-white p-1.5 text-center dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400">Pot. Aparente</span>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {apparentPower ? `${apparentPower} VA` : `${inverter.power_w} VA`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Barramento e Saúde Operacional */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Saúde Operacional & Isolamento
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-white p-2 dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800">
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <RiTimeLine className="size-3" />
                        Horas Totais de Vida
                      </span>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {hoursTotal ? `${hoursTotal.toLocaleString("pt-BR")} h` : "—"}
                      </p>
                    </div>
                    <div className="rounded-md bg-white p-2 dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800">
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <RiShieldCheckLine className="size-3 text-emerald-500" />
                        Barramento CC / Fuga
                      </span>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {vbus ? `${vbus.toFixed(1)}V` : "—"}{" "}
                        <span className="text-[10px] font-normal text-emerald-500">
                          ({leakageCurrent !== null ? `${leakageCurrent} mA` : "OK"})
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Hardware & Firmware */}
                <div className="border-t border-gray-200/60 pt-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <div className="flex justify-between py-0.5">
                    <span>Modelo:</span>
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                      {modelName}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>Serial:</span>
                    <span className="font-mono text-gray-600 dark:text-gray-400">{serialNum}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>Firmware:</span>
                    <span className="font-mono text-gray-600 dark:text-gray-400">{firmwareVer}</span>
                  </div>
                  {wifiSsid && (
                    <div className="flex justify-between py-0.5">
                      <span>Rede Wi-Fi:</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {wifiSsid} ({wifiRssi})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer simples de Wi-Fi quando diagnóstico está fechado */}
      {detailed && !showAdvanced && wifiRssi && (
        <p className="mt-3 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
          <RiWifiLine className="size-3.5" />
          Sinal Wi-Fi: {wifiRssi} {wifiSsid ? `· ${wifiSsid}` : ""}
        </p>
      )}
    </Card>
  );
}
