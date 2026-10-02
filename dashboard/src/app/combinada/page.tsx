import { AiEnergyAdvisor } from "@/components/AiEnergyAdvisor";
import { EnergyFlowSection } from "@/components/EnergyFlowSection";
import { WeatherEfficiencySection } from "@/components/WeatherEfficiencySection";
import { getDataSource } from "@/lib/dataSource";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Análise Integrada | Solar Hub",
  description: "Consultor de IA, fluxo de potência real e índice climático para Usina Solar em Içara/SC",
};

export default async function CombinadaPage() {
  const ds = await getDataSource();
  const [telemetry, utilityData, weatherData] = await Promise.all([
    ds.getLatestTelemetry(),
    ds.getLatestUtilityData(),
    ds.getIcaraWeatherData(),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-8">
      {/* Cabeçalho da Página */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Análise
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Consultor IA & Balanço Energético
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          IA Ativa
        </span>
      </div>

      {/* 1. SEÇÃO TOPO: CONSULTOR ENERGÉTICO IA */}
      <AiEnergyAdvisor
        plantName={telemetry?.plant_name || "Usina Solar Diego Hahn (16 kW)"}
        nominalKwp={telemetry?.total_nominal_capacity_kw || 16.0}
      />

      {/* 2. SEÇÃO MEIO: FLUXO DE ENERGIA & BALANÇO */}
      <EnergyFlowSection telemetry={telemetry} utilityData={utilityData} />

      {/* 3. SEÇÃO ABAIXO: ÍNDICE CLIMÁTICO VS EFICIÊNCIA */}
      <WeatherEfficiencySection weatherData={weatherData} />
    </main>
  );
}
