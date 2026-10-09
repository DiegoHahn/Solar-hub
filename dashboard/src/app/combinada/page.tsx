import { AiEnergyAdvisor } from "@/components/AiEnergyAdvisor";
import { EnergyFlowSection } from "@/components/EnergyFlowSection";
import { WeatherEfficiencySection } from "@/components/WeatherEfficiencySection";
import { getDataSource } from "@/lib/dataSource";
import { currentMonthGenerationKwh } from "@/lib/queries";
import { toBrasiliaIsoDate } from "@/lib/dates";
import { getServerI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getServerI18n();
  return {
    title: `${t.combined.title} | Solar Hub`,
    description: t.combined.subtitle,
  };
}

export default async function CombinadaPage() {
  const { t } = await getServerI18n();
  const ds = await getDataSource();
  const [telemetry, utilityData, weatherData, generationByDay] = await Promise.all([
    ds.getLatestTelemetry(),
    ds.getLatestUtilityData(),
    ds.getIcaraWeatherData(),
    ds.getGenerationByDay(31),
  ]);
  const monthSolarKwh = currentMonthGenerationKwh(generationByDay, toBrasiliaIsoDate(new Date()));

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {t.combined.title}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t.combined.subtitle}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {t.combined.aiActiveBadge}
        </span>
      </div>

      {/* 1. TOP SECTION: AI ENERGY ADVISOR */}
      <AiEnergyAdvisor />

      {/* 2. MIDDLE SECTION: REAL ENERGY FLOW */}
      <EnergyFlowSection telemetry={telemetry} utilityData={utilityData} monthSolarKwh={monthSolarKwh} />

      {/* 3. BOTTOM SECTION: WEATHER INDEX VS EFFICIENCY */}
      <WeatherEfficiencySection weatherData={weatherData} />
    </main>
  );
}
