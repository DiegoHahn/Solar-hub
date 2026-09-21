import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { InverterCard } from "@/components/InverterCard";
import { GenerationPeriodSection } from "@/components/GenerationPeriodSection";
import {
  RiSunLine,
  RiFlashlightLine,
  RiPercentLine,
  RiPulseLine,
  RiCpuLine,
  RiShieldCheckLine,
  RiTempHotLine,
} from "@remixicon/react";
import {
  getLatestTelemetry,
  getTodaySunCurve,
  getMonthlyGeneration,
  getMultiYearHistory,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PlacasPage() {
  const [telemetry, sunCurve, monthlyGeneration, multiYearHistory] = await Promise.all([
    getLatestTelemetry(),
    getTodaySunCurve(),
    getMonthlyGeneration(),
    getMultiYearHistory(),
  ]);

  const inverters = telemetry?.inverters_data ?? [];
  const onlineCount = inverters.filter((i) => i.status === "online").length;

  // Cálculos globais de arranjo fotovoltaico (CC) e rede (CA)
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
    .map((i) => i.raw_sensors?.power_factor)
    .filter((pf): pf is number => typeof pf === "number" && pf > 0);
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
            Placas & Inversores
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {telemetry
              ? `${onlineCount} de ${telemetry.inverters_count} inversores operando · Arranjo de 16 kWp nominal`
              : "Solis 6kW + 2x GoodWe 5kW"}
          </p>
        </div>
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
          {/* Gráfico de Geração por Período */}
          <GenerationPeriodSection
            dayCurve={sunCurve}
            monthData={monthlyGeneration}
            yearData={multiYearHistory.last12Months}
            multiYearHistory={multiYearHistory}
          />

          {/* Cards dos 3 Inversores com Strings e Diagnóstico Modbus */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {inverters.map((inv) => (
              <InverterCard key={inv.id} inverter={inv} detailed />
            ))}
          </div>

          {/* Quadro de Engenharia e Parâmetros da Usina */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Painel de Engenharia & Qualidade de Energia
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Métricas agregadas dos módulos fotovoltaicos (CC) e conversão para a rede (CA)
                </p>
              </div>
            </div>

            {/* 4 Mini Cards de Indicadores Elétricos */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-3.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <RiSunLine className="size-4 text-amber-500" />
                  Potência CC Total
                </span>
                <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {(totalDcW / 1000).toFixed(2)}{" "}
                  <span className="text-xs font-normal text-gray-400">kW CC</span>
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">6 strings ativas</p>
              </Card>

              <Card className="p-3.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <RiPercentLine className="size-4 text-emerald-500" />
                  Rendimento CC➔CA
                </span>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {overallEfficiency ? `${overallEfficiency}%` : "—"}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">Eficiência de conversão</p>
              </Card>

              <Card className="p-3.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <RiFlashlightLine className="size-4 text-blue-500" />
                  Tensão Média CA
                </span>
                <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {avgVgrid ? `${avgVgrid} V` : "—"}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">Rede Cooperaliança</p>
              </Card>

              <Card className="p-3.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <RiPulseLine className="size-4 text-indigo-500" />
                  Fator de Potência
                </span>
                <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {avgPF}
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-500">Qualidade ótima (~1.0)</p>
              </Card>
            </div>

            {/* Tabela Comparativa de Telemetria Técnica */}
            <Card className="overflow-x-auto p-0">
              <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  Comparativo Técnico Lado a Lado dos Inversores
                </p>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] text-gray-400 uppercase tracking-wider dark:border-gray-800 dark:bg-gray-900/50">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Inversor</th>
                    <th className="py-2.5 px-3 font-medium">Geração CA</th>
                    <th className="py-2.5 px-3 font-medium">Strings PV1 / PV2</th>
                    <th className="py-2.5 px-3 font-medium">Rede CA (V · A)</th>
                    <th className="py-2.5 px-3 font-medium">Freq / FP</th>
                    <th className="py-2.5 px-3 font-medium">Térmico</th>
                    <th className="py-2.5 px-4 font-medium text-right">Hoje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-mono text-[11px]">
                  {inverters.map((inv) => {
                    const raw = inv.raw_sensors || {};
                    const heatsink = raw.temperature_heatsink;
                    const pf = raw.power_factor;
                    const pv1W = inv.pv1?.w ?? 0;
                    const pv2W = inv.pv2?.w ?? 0;

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50/60 dark:hover:bg-gray-900/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-sans font-medium text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            <span>{inv.name}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {inv.model || inv.brand}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-gray-800 dark:text-gray-200">
                          <span className="font-bold text-gray-900 dark:text-gray-50">
                            {inv.power_w.toLocaleString("pt-BR")} W
                          </span>
                          <span className="block text-[10px] text-gray-400">
                            {Math.round((inv.power_w / (getNominalKw(inv) * 1000)) * 100)}% de{" "}
                            {getNominalKw(inv)}kW
                          </span>
                        </td>

                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          <span>
                            PV1: {pv1W.toLocaleString("pt-BR")}W{" "}
                            <span className="text-[10px] text-gray-400">({inv.pv1?.v ?? 0}V)</span>
                          </span>
                          <span className="block">
                            PV2: {pv2W.toLocaleString("pt-BR")}W{" "}
                            <span className="text-[10px] text-gray-400">({inv.pv2?.v ?? 0}V)</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          <span>{inv.vgrid ? `${Math.round(inv.vgrid)} V` : "—"}</span>
                          <span className="block text-[10px] text-gray-400">
                            {inv.igrid ? `${inv.igrid.toFixed(1)} A` : "—"}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          <span>{inv.fgrid ? `${inv.fgrid.toFixed(1)} Hz` : "60.0 Hz"}</span>
                          <span className="block text-[10px] text-emerald-500">
                            FP: {pf ? pf.toFixed(3) : "1.000"}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          <span className="flex items-center gap-1">
                            <RiTempHotLine className="size-3 text-rose-500" />
                            {inv.temperature_c ? `${inv.temperature_c.toFixed(1)}°C` : "—"}
                          </span>
                          {heatsink && (
                            <span className="block text-[10px] text-gray-400">
                              Dissipador: {heatsink.toFixed(1)}°C
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-sans font-semibold text-gray-900 dark:text-gray-100">
                          {inv.energy_today_kwh.toLocaleString("pt-BR")}{" "}
                          <span className="text-[10px] font-normal text-gray-400">kWh</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}

function getNominalKw(inverter: any): number {
  if (inverter.nominal_kw) return inverter.nominal_kw;
  if (inverter.id === "inv_1" || inverter.brand?.toLowerCase().includes("solis")) {
    return 6.0;
  }
  return 5.0;
}
