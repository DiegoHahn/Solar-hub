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
import {
  getLatestTelemetry,
  getLatestUtilityData,
  getTodaySunCurve,
} from "@/lib/queries";
import { getIcaraWeatherData } from "@/lib/weatherData";
import { formatRelativeTime, minutesSince } from "@/lib/formatRelativeTime";
import { getGeneratorUc } from "@/lib/utility";
import { brasiliaClock } from "@/lib/dates";
import { cx } from "@/lib/utils";
import type { BadgeProps } from "@/components/Badge";

export const dynamic = "force-dynamic";

const STALE_THRESHOLD_MIN = 30;

function bandeiraVariant(bandeira: string | undefined): BadgeProps["variant"] {
  if (!bandeira) return "neutral";
  const b = bandeira.toLowerCase();
  if (b.includes("verde")) return "success";
  if (b.includes("amarela")) return "warning";
  if (b.includes("vermelha")) return "error";
  return "neutral";
}

export default async function Home() {
  const [telemetry, utilityData, sunCurve, weatherData] = await Promise.all([
    getLatestTelemetry(),
    getLatestUtilityData(),
    getTodaySunCurve(),
    getIcaraWeatherData(),
  ]);

  const saldoCreditos = getGeneratorUc(utilityData)?.geracao_distribuida?.ValorProximoSaldoVencer ?? 0;

  const tarifaKwh = utilityData?.tarifa_referencia?.tarifa_kwh ?? 0.77658;
  const bandeira = utilityData?.tarifa_referencia?.bandeira_vigente ?? "Bandeira verde";
  const saldoReais = Math.round(saldoCreditos * tarifaKwh);

  const capacityKw = telemetry?.total_nominal_capacity_kw ?? 16.0;
  const currentPowerKw = telemetry?.total_power_kw ?? 0.0;
  
  // Percentual real da usina (pode ultrapassar 100% no pico do meio-dia, chegando a 110%-120%)
  const capacityPct = capacityKw > 0 ? Math.round((currentPowerKw / capacityKw) * 100) : 0;
  const isPeakOverload = capacityPct > 100;
  const isGenerating = currentPowerKw > 0.05;

  const { isDaytime } = brasiliaClock();

  const geradoHojeKwh = telemetry?.total_today_kwh ?? 0.0;
  const economiaHojeReais = (geradoHojeKwh * tarifaKwh).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const onlineInvertersCount =
    telemetry?.inverters_data?.filter((i) => i.status === "online").length ?? 0;

  const totalLifetimeKwh = telemetry?.total_lifetime_kwh ?? 0;
  const rendimentoHsp = capacityKw > 0 ? (geradoHojeKwh / capacityKw).toFixed(2) : "0.00";

  const telemetryAgeMin = telemetry ? minutesSince(telemetry.recorded_at) : null;
  const isStale = telemetryAgeMin !== null && telemetryAgeMin > STALE_THRESHOLD_MIN;

  // Pico da curva solar de hoje
  const peakPoint = sunCurve.reduce(
    (max, p) => (p.power_kw > max.power_kw ? p : max),
    sunCurve[0] || { power_kw: currentPowerKw, time: "—" }
  );

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-8">
      {/* Header Superior: Nome + Badges de Status e Bandeira */}
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left gap-3">
        <div className="flex flex-col items-center sm:items-start">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              Usina Solar
            </h1>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              16.0 kWp
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {utilityData?.distribuidora ?? "Cooperaliança"} · UC {utilityData?.generator_uc ?? "—"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {bandeira && <Badge variant={bandeiraVariant(bandeira)}>{bandeira}</Badge>}
        </div>
      </div>

      {/* Alerta de Desatualização (última telemetria mais antiga que STALE_THRESHOLD_MIN) */}
      {isStale && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-500/10 dark:text-amber-400">
          <RiAlertLine className="size-5 shrink-0" aria-hidden="true" />
          Coletor sem enviar dados {formatRelativeTime(telemetry!.recorded_at)}. Os
          números abaixo podem estar desatualizados.
        </div>
      )}

      {!telemetry ? (
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhuma leitura da usina ainda. Inicie o coletor (
            <code className="text-gray-700 dark:text-gray-300">python collector_inverters.py</code>
            ) para começar a ver os dados aqui.
          </p>
        </Card>
      ) : (
      <>
      {/* HERO CARD DINÂMICO (Glow, Medidor Central e Destaques) */}
      <Card
        className={cx(
          "relative overflow-hidden rounded-2xl border p-5 md:p-6 transition-all",
          isGenerating
            ? "border-amber-500/20 bg-gradient-to-br from-amber-500/[0.07] via-transparent to-orange-500/[0.04] dark:border-amber-500/30 shadow-lg shadow-amber-500/5"
            : "border-gray-200 dark:border-gray-900 bg-white dark:bg-[#090E1A]"
        )}
      >
        {/* Glow de fundo */}
        {isGenerating && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-16 size-64 rounded-full bg-amber-500/10 blur-3xl"
          />
        )}

        {/* Topo do Hero: Status Vivo */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-900">
          <div className="flex items-center gap-2">
            {isPeakOverload ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500 dark:text-amber-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                </span>
                ⚡ Pico Solar Ativo ({capacityPct}%)
              </span>
            ) : isGenerating ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500 dark:text-emerald-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                Usina em Operação
              </span>
            ) : isDaytime ? (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-500 dark:text-blue-400">
                <span className="size-2 rounded-full bg-blue-400" />
                Sem Geração (Chuva / Tempo Fechado)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <span className="size-2 rounded-full bg-gray-400" />
                Repouso Noturno (Standby)
              </span>
            )}
          </div>

          <span className="text-xs text-gray-400 dark:text-gray-500">
            {telemetry
              ? new Date(telemetry.recorded_at).toLocaleTimeString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        </div>

        {/* Centro do Hero: Medidor Circular + Métricas de Impacto */}
        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-around">
          {/* ProgressCircle com suporte a valores > 100% */}
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
                  {currentPowerKw.toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  kW instantâneo
                </span>
              </div>
            </ProgressCircle>

            <span className="mt-2 text-xs font-medium text-amber-500 dark:text-amber-400">
              {capacityPct}% da capacidade ({capacityKw} kWp)
            </span>
          </div>

          {/* Destaques Rápidos ao lado do círculo */}
          <div className="grid w-full grid-cols-1 gap-3 sm:max-w-xs">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
              <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <RiHistoryLine className="size-4 text-blue-500" />
                Geração Total (Vida)
              </span>
              <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {(totalLifetimeKwh / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWh
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
              <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <RiSunLine className="size-4 text-amber-500" />
                Rendimento Hoje (HSP)
              </span>
              <span className="text-sm font-semibold tabular-nums text-amber-500">
                {rendimentoHsp.replace(".", ",")} kWh/kWp
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
              <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <RiBuilding2Line className="size-4 text-violet-500" />
                Inversores Conectados
              </span>
              <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {onlineInvertersCount} de {telemetry?.inverters_count ?? 3} ativos
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* GRID DE KPIs (2x2 no Celular / 4 colunas no Desktop) */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          icon={RiSunLine}
          label="Gerado Hoje"
          value={geradoHojeKwh.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
          unit="kWh"
          hint={`Economia de ${economiaHojeReais}`}
          accent="amber"
        />

        <StatCard
          icon={RiWallet3Line}
          label="Saldo de Créditos"
          value={saldoCreditos.toLocaleString("pt-BR")}
          unit="kWh"
          hint={`~R$ ${saldoReais.toLocaleString("pt-BR")} em reserva`}
          accent="emerald"
        />

        <StatCard
          icon={RiFlashlightLine}
          label="Pico da Usina"
          value={peakPoint.power_kw.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
          unit="kW"
          hint={`${Math.round((peakPoint.power_kw / capacityKw) * 100)}% de 16 kWp`}
          accent="blue"
        />

        <StatCard
          icon={RiBuilding2Line}
          label="Tarifa Vigente"
          value={`R$ ${tarifaKwh.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`}
          unit="/kWh"
          hint={`${bandeira} · Rural`}
          accent="violet"
        />
      </div>

      {/* CURVA SOLAR DE HOJE (Área Interativa com Gradiente) */}
      <SunCurveChart data={sunCurve} nominalCapKw={capacityKw} />

      {/* SEÇÃO DOS INVERSORES FÍSICOS (AGRUPADOS EM UM CARD COMPACTO) */}
      <InvertersGroupCard inverters={telemetry?.inverters_data ?? []} />

      {/* ÍNDICE CLIMÁTICO VS EFICIÊNCIA SOLAR (VERSÃO ENXUTA / COMPACTA) */}
      <WeatherEfficiencySection weatherData={weatherData} compact={true} />
      </>
      )}
    </main>
  );
}
