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

interface FlowData {
  geracaoSolarKwh: number;
  autoconsumoKwh: number;
  injecaoRedeKwh: number;
  consumoRedeKwh: number;
  consumoTotalKwh: number;
  saldoLiquidoKwh: number;
  saldoAcumuladoKwh: number;
  autossuficienciaPct: number;
  aproveitamentoSolarPct: number;
  economiaAutoconsumoReais: number;
  economiaTotalReais: number;
}

const dataHoje: FlowData = {
  geracaoSolarKwh: 58.4,
  autoconsumoKwh: 16.2,
  injecaoRedeKwh: 42.2,
  consumoRedeKwh: 21.5,
  consumoTotalKwh: 37.7,
  saldoLiquidoKwh: 20.7,
  saldoAcumuladoKwh: 4051,
  autossuficienciaPct: 43.0,
  aproveitamentoSolarPct: 27.7,
  economiaAutoconsumoReais: 12.58,
  economiaTotalReais: 45.35,
};

const dataMes: FlowData = {
  geracaoSolarKwh: 1780.0,
  autoconsumoKwh: 472.0,
  injecaoRedeKwh: 1308.0,
  consumoRedeKwh: 785.0,
  consumoTotalKwh: 1257.0,
  saldoLiquidoKwh: 523.0,
  saldoAcumuladoKwh: 4051,
  autossuficienciaPct: 37.5,
  aproveitamentoSolarPct: 26.5,
  economiaAutoconsumoReais: 366.5,
  economiaTotalReais: 1258.0,
};

export function EnergyFlowSection() {
  const [timeframe, setTimeframe] = useState<"hoje" | "mes">("hoje");
  const data = timeframe === "hoje" ? dataHoje : dataMes;

  return (
    <Card className="p-4 sm:p-5">
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
        {/* NÓ 1: USINA SOLAR */}
        <div className="relative flex flex-col rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <RiSunLine className="size-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Origem</span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Usina Solar (16 kWp)
                </h3>
              </div>
            </div>
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              3 Inversores
            </span>
          </div>

          <div className="mt-4">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {data.geracaoSolarKwh.toLocaleString("pt-BR")} <span className="text-sm font-semibold">kWh</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Geração Bruta Total no período</p>
          </div>

          <div className="mt-4 space-y-2 border-t border-amber-500/20 pt-3 text-xs">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>🏠 Para o imóvel (autoconsumo):</span>
              <strong className="text-emerald-600 dark:text-emerald-400">
                {data.autoconsumoKwh.toLocaleString("pt-BR")} kWh ({data.aproveitamentoSolarPct}%)
              </strong>
            </div>
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>⚡ Para a rede (injetado):</span>
              <strong className="text-blue-600 dark:text-blue-400">
                {data.injecaoRedeKwh.toLocaleString("pt-BR")} kWh ({100 - data.aproveitamentoSolarPct}%)
              </strong>
            </div>
          </div>
        </div>

        {/* NÓ 2: O IMÓVEL (DEMANDA REAL) */}
        <div className="relative flex flex-col rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                <RiHome5Line className="size-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Destino Central</span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Consumo Real do Imóvel
                </h3>
              </div>
            </div>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Demanda Total
            </span>
          </div>

          <div className="mt-4">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {data.consumoTotalKwh.toLocaleString("pt-BR")} <span className="text-sm font-semibold">kWh</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Toda a energia usada pela propriedade</p>
          </div>

          <div className="mt-4 space-y-2 border-t border-emerald-500/20 pt-3 text-xs">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>☀️ Suprido pelo Sol (Direto):</span>
              <strong className="text-emerald-600 dark:text-emerald-400">
                {data.autoconsumoKwh.toLocaleString("pt-BR")} kWh
              </strong>
            </div>
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>🌐 Puxado da Concessionária:</span>
              <strong className="text-gray-900 dark:text-gray-100">
                {data.consumoRedeKwh.toLocaleString("pt-BR")} kWh
              </strong>
            </div>
          </div>
        </div>

        {/* NÓ 3: COOPERALIANÇA & SALDO */}
        <div className="relative flex flex-col rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 dark:border-blue-500/30 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/20">
                <RiBuilding2Line className="size-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Rede Elétrica</span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Cooperaliança (Içara/SC)
                </h3>
              </div>
            </div>
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
              Medidor GD
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                +{data.saldoLiquidoKwh.toLocaleString("pt-BR")}
              </span>
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">kWh líquido</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Superávit injetado além do consumo</p>
          </div>

          <div className="mt-4 space-y-2 border-t border-blue-500/20 pt-3 text-xs">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>🏦 Estoque Acumulado GD:</span>
              <strong className="text-blue-600 dark:text-blue-400">
                {data.saldoAcumuladoKwh.toLocaleString("pt-BR")} kWh
              </strong>
            </div>
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>💵 Reserva em R$ (Ref. R$ 0,77):</span>
              <strong className="text-emerald-600 dark:text-emerald-400">
                R$ {(data.saldoAcumuladoKwh * 0.77658).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Indicadores Chave de Eficiência do Balanço */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* KPI 1: Autossuficiência */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <RiPercentLine className="size-3.5 text-emerald-500" />
            Autossuficiência
          </div>
          <div className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {data.autossuficienciaPct.toFixed(1)}%
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Demanda suprida direto pelas placas
          </p>
        </div>

        {/* KPI 2: Aproveitamento da Usina */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <RiSunLine className="size-3.5 text-amber-500" />
            Autoconsumo Direto
          </div>
          <div className="mt-1 text-xl font-extrabold text-amber-600 dark:text-amber-400">
            {data.aproveitamentoSolarPct.toFixed(1)}%
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Da geração consumida sem passar da rede
          </p>
        </div>

        {/* KPI 3: Cobertura Energética */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <RiFlashlightLine className="size-3.5 text-blue-500" />
            Cobertura Solar
          </div>
          <div className="mt-1 text-xl font-extrabold text-blue-600 dark:text-blue-400">
            {((data.geracaoSolarKwh / data.consumoTotalKwh) * 100).toFixed(0)}%
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Geração total vs consumo total
          </p>
        </div>

        {/* KPI 4: Economia Livre de Impostos */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <RiShieldCheckLine className="size-3.5 text-purple-500" />
            Economia Estimada
          </div>
          <div className="mt-1 text-xl font-extrabold text-purple-600 dark:text-purple-400">
            R$ {data.economiaTotalReais.toFixed(2)}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {timeframe === "hoje" ? "Economia no dia" : "Economia no mês"}
          </p>
        </div>
      </div>
    </Card>
  );
}
