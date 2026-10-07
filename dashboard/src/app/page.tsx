import {
  RiAlertLine,
  RiFlashlightLine,
  RiWallet3Line,
  RiSunLine,
  RiBuilding2Line,
  RiHistoryLine,
} from "@remixicon/react";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { ProgressCircle } from "@/components/ProgressCircle";
import { Badge } from "@/components/Badge";
import { InvertersGroupCard } from "@/components/InvertersGroupCard";
import { WeatherEfficiencySection } from "@/components/WeatherEfficiencySection";
import { SunCurveChart } from "@/components/SunCurveChart";
import { getDataSource } from "@/lib/dataSource";
import { minutesSince } from "@/lib/dates";
import { getGeneratorUc, maskUcCode, tariffFlagVariant, translateTariffFlag } from "@/lib/utility";
import { brasiliaClock } from "@/lib/dates";
import { cx } from "@/lib/utils";
import { getServerI18n } from "@/i18n/server";
import { formatNumber, formatCurrency, formatRelativeTime, interpolate } from "@/i18n/formatters";

export const dynamic = "force-dynamic";

const STALE_THRESHOLD_MIN = 30;

export default async function Home() {
  const [{ t, locale }, ds] = await Promise.all([getServerI18n(), getDataSource()]);
  const [telemetry, utilityData, sunCurve, weatherData] = await Promise.all([
    ds.getLatestTelemetry(),
    ds.getLatestUtilityData(),
    ds.getTodaySunCurve(),
    ds.getIcaraWeatherData(),
  ]);

  const creditBalanceKwh = getGeneratorUc(utilityData)?.geracao_distribuida?.ValorProximoSaldoVencer ?? 0;

  const tariffPerKwh = utilityData?.tarifa_referencia?.tarifa_kwh ?? 0.77658;
  const bandeira = utilityData?.tarifa_referencia?.bandeira_vigente ?? "Bandeira verde";
  const creditBalanceBrl = Math.round(creditBalanceKwh * tariffPerKwh);

  const capacityKw = telemetry?.total_nominal_capacity_kw ?? 16.0;
  const currentPowerKw = telemetry?.total_power_kw ?? 0.0;
  
  // Actual plant capacity ratio (can exceed 100% during midday irradiance peaks, reaching 110%-120%)
  const capacityPct = capacityKw > 0 ? Math.round((currentPowerKw / capacityKw) * 100) : 0;
  const isPeakOverload = capacityPct > 100;
  const isGenerating = currentPowerKw > 0.05;

  const { isDaytime } = brasiliaClock();

  const geradoHojeKwh = telemetry?.total_today_kwh ?? 0.0;
  const todaySavingsBrl = formatCurrency(geradoHojeKwh * tariffPerKwh, locale);

  const onlineInvertersCount =
    telemetry?.inverters_data?.filter((i) => i.status === "online").length ?? 0;

  const totalLifetimeKwh = telemetry?.total_lifetime_kwh ?? 0;
  const rendimentoHsp = capacityKw > 0 ? (geradoHojeKwh / capacityKw).toFixed(2) : "0.00";

  const telemetryAgeMin = telemetry ? minutesSince(telemetry.recorded_at) : null;
  const isStale = telemetryAgeMin !== null && telemetryAgeMin > STALE_THRESHOLD_MIN;

  // Peak of today's solar production curve
  const peakPoint = sunCurve.reduce(
    (max, p) => ((p.power_kw ?? 0) > (max.power_kw ?? 0) ? p : max),
    sunCurve.find((p) => p.power_kw !== null) || { power_kw: currentPowerKw, time: "—" }
  );
  const peakKw = peakPoint.power_kw ?? 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-8">
      {/* Top Header: Plant title + Status & tariff flag badges */}
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left gap-3">
        <div className="flex flex-col items-center sm:items-start">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {t.overview.plantTitle}
            </h1>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              16.0 kWp
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {utilityData?.distribuidora ?? "Cooperaliança"} · UC {maskUcCode(utilityData?.generator_uc)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {bandeira && <Badge variant={tariffFlagVariant(bandeira)}>{translateTariffFlag(bandeira, t)}</Badge>}
        </div>
      </div>

      {/* Stale Telemetry Alert (telemetry older than STALE_THRESHOLD_MIN) */}
      {isStale && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-500/10 dark:text-amber-400">
          <RiAlertLine className="size-5 shrink-0" aria-hidden="true" />
          {t.overview.staleTelemetryAlert} {formatRelativeTime(telemetry!.recorded_at, locale)}.
        </div>
      )}

      {!telemetry ? (
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t.overview.noTelemetryYet}
          </p>
        </Card>
      ) : (
      <>
      {/* DYNAMIC HERO CARD (Glow, Circular Gauge, and Key Highlights) */}
      <Card
        className={cx(
          "relative overflow-hidden rounded-2xl border p-5 md:p-6 transition-all",
          isGenerating
            ? "border-amber-500/20 bg-gradient-to-br from-amber-500/[0.07] via-transparent to-orange-500/[0.04] dark:border-amber-500/30 shadow-lg shadow-amber-500/5"
            : "border-gray-200 dark:border-gray-900 bg-white dark:bg-[#090E1A]"
        )}
      >
        {/* Background glow */}
        {isGenerating && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-16 size-64 rounded-full bg-amber-500/10 blur-3xl"
          />
        )}

        {/* Hero Top: Live operational status */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-900">
          <div className="flex items-center gap-2">
            {isPeakOverload ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500 dark:text-amber-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                </span>
                {t.overview.activePeak} ({capacityPct}%)
              </span>
            ) : isGenerating ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500 dark:text-emerald-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                {t.overview.plantOperating}
              </span>
            ) : isDaytime ? (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-500 dark:text-blue-400">
                <span className="size-2 rounded-full bg-blue-400" />
                {t.overview.noGenerationWeather}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <span className="size-2 rounded-full bg-gray-400" />
                {t.overview.nighttimeStandby}
              </span>
            )}
          </div>

          <span className="text-xs text-gray-400 dark:text-gray-500">
            {telemetry
              ? new Date(telemetry.recorded_at).toLocaleTimeString(locale === "pt-BR" ? "pt-BR" : "en-US", {
                  timeZone: "America/Sao_Paulo",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        </div>

        {/* Hero Center: Circular Gauge + Impact Metrics */}
        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-around">
          {/* ProgressCircle supporting values > 100% */}
          <div className="flex flex-col items-center">
            <ProgressCircle
              value={Math.min(120, capacityPct)}
              max={120}
              radius={76}
              strokeWidth={11}
              variant={isPeakOverload ? "warning" : isGenerating ? "solar" : "neutral"}
              className="relative shrink-0"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-3xl font-bold tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
                  {formatNumber(currentPowerKw, locale, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t.overview.instantKw}
                </span>
              </div>
            </ProgressCircle>

            <span className="mt-2 text-xs font-medium text-amber-500 dark:text-amber-400">
              {interpolate(t.overview.ofCapacity, {
                pct: capacityPct,
                cap: capacityKw,
              })}
            </span>
          </div>

          {/* Quick Metrics alongside circular gauge */}
          <div className="grid w-full grid-cols-1 gap-3 sm:max-w-xs">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
              <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <RiHistoryLine className="size-4 text-blue-500" />
                {t.overview.lifetimeGeneration}
              </span>
              <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {formatNumber(totalLifetimeKwh / 1000, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWh
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
              <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <RiSunLine className="size-4 text-amber-500" />
                {t.overview.yieldHsp}
              </span>
              <span className="text-sm font-semibold tabular-nums text-amber-500">
                {formatNumber(Number(rendimentoHsp), locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh/kWp
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
              <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <RiBuilding2Line className="size-4 text-violet-500" />
                {t.overview.connectedInverters}
              </span>
              <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {interpolate(t.overview.activeOfTotal, {
                  active: onlineInvertersCount,
                  total: telemetry?.inverters_count ?? 3,
                })}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI GRID (2x2 Mobile / 4 Columns Desktop) */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          icon={RiSunLine}
          label={t.overview.generationToday}
          value={formatNumber(geradoHojeKwh, locale, { minimumFractionDigits: 1 })}
          unit={t.common.kwh}
          hint={interpolate(t.overview.savingsOf, { val: todaySavingsBrl })}
          accent="amber"
        />

        <StatCard
          icon={RiWallet3Line}
          label={t.overview.accumulatedBalance}
          value={formatNumber(creditBalanceKwh, locale)}
          unit={t.common.kwh}
          hint={`~${formatCurrency(creditBalanceBrl, locale)} ${t.overview.inReserve}`}
          accent="emerald"
        />

        <StatCard
          icon={RiFlashlightLine}
          label={t.overview.peakPower}
          value={formatNumber(peakKw, locale, { minimumFractionDigits: 1 })}
          unit={t.common.kw}
          hint={interpolate(t.overview.peakPowerHint, {
            pct: Math.round((peakKw / capacityKw) * 100),
            cap: capacityKw,
          })}
          accent="blue"
        />

        <StatCard
          icon={RiBuilding2Line}
          label={t.overview.currentTariff}
          value={formatCurrency(tariffPerKwh, locale)}
          unit={`/${t.common.kwh}`}
          hint={`${translateTariffFlag(bandeira, t)} · ${t.utility.ruralSubgroup}`}
          accent="violet"
        />
      </div>

      {/* TODAY'S SOLAR CURVE (Interactive area with gradient) */}
      <SunCurveChart data={sunCurve} nominalCapKw={capacityKw} />

      {/* PHYSICAL INVERTERS SECTION (Grouped in compact card) */}
      <InvertersGroupCard inverters={telemetry?.inverters_data ?? []} />

      {/* WEATHER INDEX VS SOLAR EFFICIENCY SECTION */}
      <WeatherEfficiencySection weatherData={weatherData} compact={true} />
      </>
      )}
    </main>
  );
}
