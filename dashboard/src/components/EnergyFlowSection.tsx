"use client";

import { useState } from "react";
import {
  RiSunLine,
  RiHome5Line,
  RiBuilding2Line,
  RiArrowRightLine,
  RiArrowDownLine,
  RiFlashlightLine,
  RiShieldCheckLine,
  RiInformationLine,
  RiPercentLine,
} from "@remixicon/react";
import { Card } from "@/components/Card";
import { cx } from "@/lib/utils";
import type { SolarTelemetryRow, UtilityDataRow } from "@/lib/types";
import { GENERATOR_UC } from "@/lib/constants";

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
  const [timeframe, setTimeframe] = useState<"hoje" | "mes">("hoje");

  const uc = utilityData?.unidades_consumidoras?.[GENERATOR_UC];
  const gd = uc?.geracao_distribuida;
  const fatura = uc?.resumo_ultima_fatura;
  const hist12 = (uc as any)?.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal || [];
  const lastMonthItem = hist12.length > 0 ? hist12[hist12.length - 1] : null;

  const tarifaKwh = utilityData?.tarifa_referencia?.tarifa_kwh ?? 0.77658;
  const saldoTotalAcumuladoKwh = gd?.ValorProximoSaldoVencer ?? 0;
  const reservaTotalReais = Math.round(saldoTotalAcumuladoKwh * tarifaKwh);

  // Dados reais de Hoje
  const geracaoHojeKwh = telemetry?.total_today_kwh ?? 0;
  const economiaHojeReais = geracaoHojeKwh * tarifaKwh;

  // Dados reais do Mês (Última Fatura / Histórico Cooperaliança)
  const mesInjetadoKwh = lastMonthItem?.KwhGerado ?? 0;
  const mesCompensadoKwh = lastMonthItem?.kwhCreditado ?? 0;
  const mesSaldoLiquidoKwh = mesInjetadoKwh - mesCompensadoKwh; // Superávit que virou crédito no mês
  const consumoFaturadoKwh = fatura?.KwhReal ?? 0;
  const geracaoMesEstimadaOuReal = monthSolarKwh > 0 ? monthSolarKwh : mesInjetadoKwh;
  const economiaMesReais = mesInjetadoKwh * tarifaKwh;

  const isHoje = timeframe === "hoje";

  return (
    <Card className="p-4 sm:p-6">
      {/* Cabeçalho da Seção */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900 sm:text-base dark:text-gray-100">
            Fluxo de Energia Real
          </h2>
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            Placas + Cooperativa
          </span>
        </div>

        {/* Toggle Hoje / Mês */}
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800 text-xs">
          <button
            type="button"
            onClick={() => setTimeframe("hoje")}
            className={cx(
              "rounded-md px-2.5 py-1 font-semibold transition-colors",
              timeframe === "hoje"
                ? "bg-white text-gray-900 shadow-sm dark:bg-blue-600 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setTimeframe("mes")}
            className={cx(
              "rounded-md px-2.5 py-1 font-semibold transition-colors",
              timeframe === "mes"
                ? "bg-white text-gray-900 shadow-sm dark:bg-blue-600 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            Mês Atual
          </button>
        </div>
      </div>

      {/* Grid de 3 Cards com o Fluxo de Potência */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* NÓ 1: USINA SOLAR (GERAÇÃO BRUTA REAL) */}
          <div className="relative flex flex-col rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-md shadow-amber-500/20">
                  <RiSunLine className="size-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Origem Real</span>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Usina Solar (16 kWp)
                  </h3>
                </div>
              </div>
              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                {telemetry?.inverters_count ?? telemetry?.inverters_data?.length ?? 0} Inversores
              </span>
            </div>

            <div className="mt-4">
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {(isHoje ? geracaoHojeKwh : geracaoMesEstimadaOuReal).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
                <span className="text-sm font-semibold">kWh</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isHoje ? "Geração física medida nos inversores hoje" : "Geração total do período"}
              </p>
            </div>

            <div className="mt-4 space-y-2 border-t border-amber-500/20 pt-3 text-xs">
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span>⚡ Potência atual:</span>
                <strong className="text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  {telemetry ? `${telemetry.total_power_kw.toFixed(1)} kW` : "—"}
                </strong>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span>💰 Valor gerado:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  R$ {(isHoje ? economiaHojeReais : economiaMesReais).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>

          {/* NÓ 2: INJEÇÃO NA REDE (REGISTRO COOPERALIANÇA) */}
          <div className="relative flex flex-col rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 dark:border-blue-500/30 dark:bg-blue-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/20">
                  <RiBuilding2Line className="size-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Distribuição</span>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Cooperaliança (Içara/SC)
                  </h3>
                </div>
              </div>
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                Medidor Bidirecional
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {isHoje ? "—" : `+${mesInjetadoKwh.toLocaleString("pt-BR")}`}
                </span>
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  {isHoje ? "fechamento mensal" : "kWh injetados"}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isHoje
                  ? "Consolidado na fatura da cooperativa"
                  : "Excedente medido no relógio da concessionária"}
              </p>
            </div>

            <div className="mt-4 space-y-2 border-t border-blue-500/20 pt-3 text-xs">
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span>🔄 Compensado:</span>
                <strong className="text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  {mesCompensadoKwh.toLocaleString("pt-BR")} kWh
                </strong>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span>📈 Superávit líquido:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  +{mesSaldoLiquidoKwh.toLocaleString("pt-BR")} kWh
                </strong>
              </div>
            </div>
          </div>

          {/* NÓ 3: SALDO ACUMULADO GD (ESTOQUE REAL) */}
          <div className="relative flex flex-col rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                  <RiShieldCheckLine className="size-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Reserva Energética</span>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Estoque Total GD
                  </h3>
                </div>
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                UC {GENERATOR_UC}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {saldoTotalAcumuladoKwh.toLocaleString("pt-BR")}
                </span>
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">kWh saldo</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Créditos ativos disponíveis na cooperativa</p>
            </div>

            <div className="mt-4 space-y-2 border-t border-emerald-500/20 pt-3 text-xs">
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span>💵 Valor da reserva:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  R$ {reservaTotalReais.toLocaleString("pt-BR")}
                </strong>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span>📅 Vencimento próx:</span>
                <strong className="text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {gd?.ProximoSaldoVencer ?? "Próx. ciclo"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Indicadores Chave de Eficiência do Balanço */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* KPI 1: Produção Hoje */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <RiSunLine className="size-3.5 text-amber-500" />
              Geração Hoje
            </div>
            <div className="mt-1 text-xl font-extrabold text-amber-600 dark:text-amber-400">
              {geracaoHojeKwh.toFixed(1)} kWh
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Medição física direta dos inversores
            </p>
          </div>

          {/* KPI 2: Injeção Faturada */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <RiBuilding2Line className="size-3.5 text-blue-500" />
              Injetado no Mês
            </div>
            <div className="mt-1 text-xl font-extrabold text-blue-600 dark:text-blue-400">
              {mesInjetadoKwh.toLocaleString("pt-BR")} kWh
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Faturado pela Cooperaliança
            </p>
          </div>

          {/* KPI 3: Saldo GD */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <RiShieldCheckLine className="size-3.5 text-emerald-500" />
              Saldo Acumulado
            </div>
            <div className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {saldoTotalAcumuladoKwh.toLocaleString("pt-BR")} kWh
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Estoque total de créditos da usina
            </p>
          </div>

          {/* KPI 4: Economia Financeira */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <RiFlashlightLine className="size-3.5 text-purple-500" />
              Economia Estimada
            </div>
            <div className="mt-1 text-xl font-extrabold text-purple-600 dark:text-purple-400">
              R$ {(isHoje ? economiaHojeReais : economiaMesReais).toFixed(2)}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {isHoje ? "Economia no dia de hoje" : "Economia no mês faturado"}
            </p>
          </div>
        </div>
      </Card>
    );
  }
