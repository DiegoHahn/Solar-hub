"use client";

import { useState } from "react";
import {
  RiSparklingFill,
  RiRefreshLine,
  RiSunLine,
  RiCalendarLine,
  RiFlashlightLine,
  RiTempHotLine,
  RiShieldCheckLine,
  RiMoneyDollarCircleLine,
  RiCompass3Line,
  RiToolsLine,
} from "@remixicon/react";
import { cx } from "@/lib/utils";

interface AiEnergyAdvisorProps {
  plantName?: string;
  nominalKwp?: number;
}

export function AiEnergyAdvisor({
  nominalKwp = 16.0,
}: AiEnergyAdvisorProps) {
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-950/20 via-gray-950 to-gray-950 p-4 sm:p-5 shadow-lg dark:border-purple-500/30">
      {/* Luz ambiente suave de IA */}
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-purple-600/10 blur-3xl" />

      {/* Top Header: Ícone, Título e Controles */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-purple-500/15 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/25">
            <RiSparklingFill className="size-4" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-bold text-gray-900 sm:text-base dark:text-gray-100">
            Consultor Energético IA
          </h2>
        </div>

        {/* Controles: Toggle Diário/Mensal + Botão Regerar */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs">
            <button
              type="button"
              onClick={() => setPeriod("daily")}
              className={cx(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-all",
                period === "daily"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-purple-600 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              <RiSunLine className="size-3" aria-hidden="true" />
              Diário
            </button>
            <button
              type="button"
              onClick={() => setPeriod("monthly")}
              className={cx(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-all",
                period === "monthly"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-purple-600 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              <RiCalendarLine className="size-3" aria-hidden="true" />
              Mensal
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RiRefreshLine
              className={cx("size-3", isRefreshing && "animate-spin text-purple-500")}
              aria-hidden="true"
            />
            {isRefreshing ? "Analisando..." : "Regerar"}
          </button>
        </div>
      </div>

      {/* Síntese Executiva Gerada pela IA */}
      <div className="relative mt-3.5 rounded-xl border border-purple-500/15 bg-purple-950/15 p-3.5 dark:border-purple-500/25 dark:bg-purple-950/25">
        {period === "daily" ? (
          <p className="text-xs sm:text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            Usina de <strong className="text-purple-600 dark:text-purple-300">{nominalKwp} kWp</strong> operando em alta eficiência em Içara/SC. Gerou <strong className="text-emerald-600 dark:text-emerald-400">58,4 kWh</strong> (3,65 kWh/kWp), atingindo pico de <strong className="text-purple-600 dark:text-purple-300">16,9 kW</strong> às 12:30 (105% nominal). A geração supriu 100% da demanda diurna, com <strong className="text-emerald-600 dark:text-emerald-400">16,2 kWh (27,7%)</strong> em autoconsumo direto e <strong className="text-blue-600 dark:text-blue-400">42,2 kWh</strong> injetados na rede.
          </p>
        ) : (
          <p className="text-xs sm:text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            No acumulado do mês, a usina produziu <strong className="text-emerald-600 dark:text-emerald-400">1.620 kWh</strong> frente a uma demanda total de <strong className="text-purple-600 dark:text-purple-300">1.257 kWh</strong> (cobertura solar de <strong className="text-purple-600 dark:text-purple-300">128,8%</strong>). O saldo na Cooperaliança foi superavitário em <strong className="text-emerald-600 dark:text-emerald-400">+1.308 kWh</strong>, elevando o estoque histórico para <strong className="text-purple-600 dark:text-purple-300">4.051 kWh</strong> (~R$ 3.145).
          </p>
        )}
      </div>

      {/* 3 Recomendações Diretas em Lista Limpa (sem cards gigantes) */}
      <div className="relative mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {period === "daily" ? (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-gray-200/80 bg-white/60 p-2.5 text-xs dark:border-gray-800 dark:bg-gray-900/50">
              <div className="flex size-5 shrink-0 items-center justify-center rounded bg-amber-500/10 text-amber-500 mt-0.5">
                <RiFlashlightLine className="size-3.5" />
              </div>
              <div className="min-w-0">
                <strong className="block text-gray-900 dark:text-gray-100">Janela de Autoconsumo</strong>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Cargas pesadas ideais entre <strong className="text-amber-500">11h e 14h30</strong> (100% livre de tributos).
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-gray-200/80 bg-white/60 p-2.5 text-xs dark:border-gray-800 dark:bg-gray-900/50">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 mt-0.5">
                <RiTempHotLine className="size-3.5" />
              </div>
              <div className="min-w-0">
                <strong className="block text-gray-900 dark:text-gray-100">Saúde dos Inversores</strong>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Temperatura média estável em <strong className="text-blue-500">40,8°C</strong>, strings PV balanceadas.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-gray-200/80 bg-white/60 p-2.5 text-xs dark:border-gray-800 dark:bg-gray-900/50">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 mt-0.5">
                <RiCompass3Line className="size-3.5" />
              </div>
              <div className="min-w-0">
                <strong className="block text-gray-900 dark:text-gray-100">Previsão para Amanhã</strong>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Sol com nuvens; geração estimada entre <strong className="text-purple-400">52 e 58 kWh</strong>.
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-gray-200/80 bg-white/60 p-2.5 text-xs dark:border-gray-800 dark:bg-gray-900/50">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 mt-0.5">
                <RiShieldCheckLine className="size-3.5" />
              </div>
              <div className="min-w-0">
                <strong className="block text-gray-900 dark:text-gray-100">Autonomia de Reserva</strong>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  <strong className="text-emerald-500">4.051 kWh</strong> garantem &gt;4,5 meses de cobertura para o inverno.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-gray-200/80 bg-white/60 p-2.5 text-xs dark:border-gray-800 dark:bg-gray-900/50">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 mt-0.5">
                <RiMoneyDollarCircleLine className="size-3.5" />
              </div>
              <div className="min-w-0">
                <strong className="block text-gray-900 dark:text-gray-100">Economia no Mês</strong>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Retorno de <strong className="text-blue-500">~R$ 1.258,00</strong> com 100% de isenção no Fio B (GD I).
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-gray-200/80 bg-white/60 p-2.5 text-xs dark:border-gray-800 dark:bg-gray-900/50">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 mt-0.5">
                <RiToolsLine className="size-3.5" />
              </div>
              <div className="min-w-0">
                <strong className="block text-gray-900 dark:text-gray-100">Eficiência & Limpeza</strong>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Performance Ratio em <strong className="text-purple-400">81,2%</strong>; sem necessidade de lavagem.
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
