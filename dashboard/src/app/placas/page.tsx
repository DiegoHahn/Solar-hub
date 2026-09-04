import { RiSparklingLine } from "@remixicon/react";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { InverterCard } from "@/components/InverterCard";
import { GenerationPeriodSection } from "@/components/GenerationPeriodSection";
import {
  getLatestTelemetry,
  getTodaySunCurve,
  getMonthlyGeneration,
  getYearlyGeneration,
  USE_MOCK,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PlacasPage() {
  const [telemetry, sunCurve, monthlyGeneration, yearlyGeneration] = await Promise.all([
    getLatestTelemetry(),
    getTodaySunCurve(),
    getMonthlyGeneration(),
    getYearlyGeneration(),
  ]);

  const onlineCount = telemetry?.inverters_data.filter((i) => i.status === "online").length ?? 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Placas
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {telemetry
              ? `${onlineCount} de ${telemetry.inverters_count} inversores operando`
              : "Solis 6kW + 2x GoodWe 5kW"}
          </p>
        </div>
        {USE_MOCK && (
          <Badge
            variant="neutral"
            className="flex items-center gap-1 border-amber-500/30 bg-amber-500/10 text-xs text-amber-500 dark:text-amber-400"
          >
            <RiSparklingLine className="size-3.5" />
            Modo Simulado
          </Badge>
        )}
      </div>

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
          <GenerationPeriodSection
            dayCurve={sunCurve}
            monthData={monthlyGeneration}
            yearData={yearlyGeneration}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {telemetry.inverters_data.map((inv) => (
              <InverterCard key={inv.id} inverter={inv} detailed />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
