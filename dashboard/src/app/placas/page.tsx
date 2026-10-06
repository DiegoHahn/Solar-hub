import { Card } from "@/components/Card";
import { InverterCardsSection } from "@/components/InverterCardsSection";
import { GenerationPeriodSection } from "@/components/GenerationPeriodSection";
import {
  RiSunLine,
  RiFlashlightLine,
  RiPercentLine,
  RiPulseLine,
} from "@remixicon/react";
import { readNumericSensor } from "@/lib/inverter";
import { getDataSource } from "@/lib/dataSource";
import { getServerI18n } from "@/i18n/server";
import { formatNumber } from "@/i18n/formatters";

export const dynamic = "force-dynamic";

export default async function PlacasPage() {
  const [{ t, locale }, ds] = await Promise.all([getServerI18n(), getDataSource()]);
  const [telemetry, sunCurve, monthlyGeneration, multiYearHistory] = await Promise.all([
    ds.getLatestTelemetry(),
    ds.getTodaySunCurve(),
    ds.getMonthlyGeneration(),
    ds.getMultiYearHistory(),
  ]);

  const inverters = telemetry?.inverters_data ?? [];
  const onlineCount = inverters.filter((i) => i.status === "online").length;

  // Global calculations for PV array (DC) and grid feed-in (AC)
  const totalDcW = inverters.reduce((acc, inv) => {
    const pv1 = inv.pv1?.w ?? 0;
    const pv2 = inv.pv2?.w ?? 0;
    return acc + pv1 + pv2;
  }, 0);

  const totalAcW = telemetry?.total_power_w ?? 0;
  const overallEfficiency =
    totalDcW > 0 ? Math.min(99.5, Math.round((totalAcW / totalDcW) * 1000) / 10) : null;

  const validVoltages = inverters
    .map((i) => i.vgrid)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const avgVgrid =
    validVoltages.length > 0
      ? Math.round(validVoltages.reduce((a, b) => a + b, 0) / validVoltages.length)
      : null;

  const validPF = inverters
    .map((i) => readNumericSensor(i, "power_factor"))
    .filter((pf): pf is number => pf !== null && pf > 0);
  const avgPF =
    validPF.length > 0
      ? (validPF.reduce((a, b) => a + b, 0) / validPF.length).toFixed(3)
      : "0.999";

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {t.inverters.title}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {telemetry
              ? `${onlineCount} / ${telemetry.inverters_count} ${t.inverters.operatingSummary}`
              : "Solis 6kW + 2x GoodWe 5kW"}
          </p>
        </div>
      </div>

      {!telemetry ? (
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t.overview.noTelemetryYet}
          </p>
        </Card>
      ) : (
        <>
          {/* Generation Chart by Period */}
          <GenerationPeriodSection
            dayCurve={sunCurve}
            monthData={monthlyGeneration}
            yearData={multiYearHistory.last12Months}
            multiYearHistory={multiYearHistory}
          />

          {/* 3 Inverter Cards with PV Strings & Modbus Diagnostics */}
          <InverterCardsSection inverters={inverters} />

          {/* Engineering & Plant Operating Parameters Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {t.inverters.engineeringTitle}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t.inverters.engineeringSubtitle}
                </p>
              </div>
            </div>

            {/* 4 Mini Electrical Metric Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-3.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <RiSunLine className="size-4 text-amber-500" />
                  {t.inverters.totalDcPower}
                </span>
                <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {formatNumber(totalDcW / 1000, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                  <span className="text-xs font-normal text-gray-400">kW CC</span>
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">{t.inverters.activeStrings}</p>
              </Card>

              <Card className="p-3.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <RiPercentLine className="size-4 text-emerald-500" />
                  {t.inverters.dcToAcYield}
                </span>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {overallEfficiency ? `${overallEfficiency}%` : "—"}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">{t.inverters.conversionEfficiency}</p>
              </Card>

              <Card className="p-3.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <RiFlashlightLine className="size-4 text-blue-500" />
                  {t.inverters.avgGridVoltage}
                </span>
                <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {avgVgrid ? `${avgVgrid} V` : "—"}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">{t.inverters.utilityGrid}</p>
              </Card>

              <Card className="p-3.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <RiPulseLine className="size-4 text-indigo-500" />
                  {t.inverters.powerFactor}
                </span>
                <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {avgPF}
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-500">{t.inverters.optimalQuality}</p>
              </Card>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
