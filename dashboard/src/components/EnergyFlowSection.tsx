"use client";

import { useState } from "react";
import {
  RiSunLine,
  RiBuilding2Line,
  RiFlashlightLine,
  RiShieldCheckLine,
} from "@remixicon/react";
import { Card } from "@/components/Card";
import { cx } from "@/lib/utils";
import type { SolarTelemetryRow, UtilityDataRow } from "@/lib/types";
import { getGeneratorUc, getTariffPerKwh, maskUcCode } from "@/lib/utility";
import { useI18n, formatNumber, formatCurrency, formatCurrencyEstimate, formatPortalDate } from "@/i18n";

interface EnergyFlowSectionProps {
  telemetry: SolarTelemetryRow | null;
  utilityData: UtilityDataRow | null;
  monthSolarKwh?: number;
}

export function EnergyFlowSection({
  telemetry,
  utilityData,
  monthSolarKwh = 0,
}: EnergyFlowSectionProps) {
  const { t, locale } = useI18n();
  const [timeframe, setTimeframe] = useState<"today" | "month">("today");

  const uc = getGeneratorUc(utilityData);
  const gd = uc?.geracao_distribuida;
  const hist12 = uc?.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal || [];
  const lastMonthItem = hist12.length > 0 ? hist12[hist12.length - 1] : null;

  const tariffPerKwh = getTariffPerKwh(utilityData);
  const creditBalanceKwh = gd?.ValorProximoSaldoVencer ?? 0;
  const creditReserveBrl = tariffPerKwh !== null ? creditBalanceKwh * tariffPerKwh : null;

  // Today's inverter telemetry data
  const todayGenerationKwh = telemetry?.total_today_kwh ?? 0;
  const todaySavingsBrl = tariffPerKwh !== null ? todayGenerationKwh * tariffPerKwh : null;

  // Monthly data (last invoice / Cooperaliança history)
  const monthInjectedKwh = lastMonthItem?.KwhGerado ?? 0;
  const monthCompensatedKwh = lastMonthItem?.kwhCreditado ?? 0;
  const monthNetBalanceKwh = monthInjectedKwh - monthCompensatedKwh;
  const monthGenerationKwh = monthSolarKwh > 0 ? monthSolarKwh : monthInjectedKwh;
  const monthSavingsBrl = tariffPerKwh !== null ? monthInjectedKwh * tariffPerKwh : null;
  const savingsBrl = timeframe === "today" ? todaySavingsBrl : monthSavingsBrl;
  const savingsLabel = savingsBrl !== null ? formatCurrency(savingsBrl, locale) : "—";

  const isToday = timeframe === "today";

  return (
    <Card className="p-4 sm:p-6">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900 sm:text-base dark:text-gray-100">
            {t.combined.energyFlowTitle}
          </h2>
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            {t.combined.panelsPlusUtility}
          </span>
        </div>

        {/* Toggle: Today / Month */}
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800 text-xs">
          <button
            type="button"
            onClick={() => setTimeframe("today")}
            className={cx(
              "rounded-md px-2.5 py-1 font-semibold transition-colors",
              timeframe === "today"
                ? "bg-white text-gray-900 shadow-sm dark:bg-blue-600 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            {t.combined.todayBtn}
          </button>
          <button
            type="button"
            onClick={() => setTimeframe("month")}
            className={cx(
              "rounded-md px-2.5 py-1 font-semibold transition-colors",
              timeframe === "month"
                ? "bg-white text-gray-900 shadow-sm dark:bg-blue-600 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            {t.combined.currentMonthBtn}
          </button>
        </div>
      </div>

      {/* 3 Node Cards Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* NODE 1: SOLAR PLANT */}
        <div className="relative flex flex-col rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <RiSunLine className="size-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {t.combined.realOrigin}
                </span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {t.combined.solarPlantTitle.replace("{capacity}", "16")}
                </h3>
              </div>
            </div>
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {t.combined.invertersCount.replace(
                "{count}",
                String(telemetry?.inverters_count ?? telemetry?.inverters_data?.length ?? 0)
              )}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {formatNumber(isToday ? todayGenerationKwh : monthGenerationKwh, locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{" "}
              <span className="text-sm font-semibold">kWh</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isToday ? t.combined.physicalGenerationToday : t.combined.periodTotalGeneration}
            </p>
          </div>

          <div className="mt-4 space-y-2 border-t border-amber-500/20 pt-3 text-xs">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>{t.combined.currentPowerLabel}</span>
              <strong className="text-amber-600 dark:text-amber-400 whitespace-nowrap">
                {telemetry ? `${formatNumber(telemetry.total_power_kw, locale, { minimumFractionDigits: 1 })} kW` : "—"}
              </strong>
            </div>
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>{t.combined.generatedValueLabel}</span>
              <strong className="text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                {savingsLabel}
              </strong>
            </div>
          </div>
        </div>

        {/* NODE 2: GRID INJECTION */}
        <div className="relative flex flex-col rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 dark:border-blue-500/30 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/20">
                <RiBuilding2Line className="size-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {t.combined.distribution}
                </span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Cooperaliança (Içara/SC)
                </h3>
              </div>
            </div>
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
              {t.combined.bidirectionalMeter}
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {isToday ? "—" : `+${formatNumber(monthInjectedKwh, locale)}`}
              </span>
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {isToday ? t.combined.monthlyClosing : t.combined.kwhInjected}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isToday ? t.combined.consolidatedInUtility : t.combined.utilityExcessMeasured}
            </p>
          </div>

          <div className="mt-4 space-y-2 border-t border-blue-500/20 pt-3 text-xs">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>{t.combined.compensatedLabel}</span>
              <strong className="text-blue-600 dark:text-blue-400 whitespace-nowrap">
                {formatNumber(monthCompensatedKwh, locale)} kWh
              </strong>
            </div>
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>{t.combined.netSurplusLabel}</span>
              <strong className="text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                +{formatNumber(monthNetBalanceKwh, locale)} kWh
              </strong>
            </div>
          </div>
        </div>

        {/* NODE 3: DG ACCUMULATED BALANCE */}
        <div className="relative flex flex-col rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                <RiShieldCheckLine className="size-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {t.combined.energyReserve}
                </span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {t.combined.totalGdStock}
                </h3>
              </div>
            </div>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              UC {maskUcCode(utilityData?.generator_uc)}
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatNumber(creditBalanceKwh, locale)}
              </span>
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {t.combined.kwhBalance}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t.combined.activeCreditsAvailable}</p>
          </div>

          <div className="mt-4 space-y-2 border-t border-emerald-500/20 pt-3 text-xs">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>{t.combined.reserveValue}</span>
              <strong className="text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                {creditReserveBrl !== null ? formatCurrencyEstimate(creditReserveBrl, locale) : "—"}
              </strong>
            </div>
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>{t.combined.nextExpiry}</span>
              <strong className="text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {gd?.ProximoSaldoVencer ? formatPortalDate(gd.ProximoSaldoVencer, locale) : t.utility.nextCycle}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom KPI Indicators */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <RiSunLine className="size-3.5 text-amber-500" />
            {t.combined.todayGenerationKpi}
          </div>
          <div className="mt-1 text-xl font-extrabold text-amber-600 dark:text-amber-400">
            {formatNumber(todayGenerationKwh, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {t.combined.directInverterMeasurement}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <RiBuilding2Line className="size-3.5 text-blue-500" />
            {t.combined.injectedMonthKpi}
          </div>
          <div className="mt-1 text-xl font-extrabold text-blue-600 dark:text-blue-400">
            {formatNumber(monthInjectedKwh, locale)} kWh
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {t.combined.billedByUtility}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <RiShieldCheckLine className="size-3.5 text-emerald-500" />
            {t.combined.accumulatedBalanceKpi}
          </div>
          <div className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatNumber(creditBalanceKwh, locale)} kWh
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {t.combined.totalCreditsStock}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <RiFlashlightLine className="size-3.5 text-purple-500" />
            {t.combined.estimatedSavingsKpi}
          </div>
          <div className="mt-1 text-xl font-extrabold text-purple-600 dark:text-purple-400">
            {savingsLabel}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {isToday ? t.combined.economyToday : t.combined.economyMonth}
          </p>
        </div>
      </div>
    </Card>
  );
}
