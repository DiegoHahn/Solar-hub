"use client";

import { useState, useEffect } from "react";
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

interface Recommendation {
  title: string;
  description: string;
  icon: "flashlight" | "temp" | "compass" | "shield" | "dollar" | "tools" | string;
}

interface PeriodData {
  summary: string;
  recommendations: Recommendation[];
}

interface UnifiedAdvisorData {
  daily: PeriodData;
  monthly: PeriodData;
  modelUsed?: string;
  switchedDueToQuota?: boolean;
  quotaCount?: number;
  maxPrimaryQuota?: number;
  isCached?: boolean;
  updatedAt?: string;
  warning?: string;
}

interface AiEnergyAdvisorProps {
  plantName?: string;
  nominalKwp?: number;
}

export function AiEnergyAdvisor({
  nominalKwp = 16.0,
}: AiEnergyAdvisorProps) {
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");
  const [data, setData] = useState<UnifiedAdvisorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Carrega a análise ao montar (aproveita o cache de hoje se existir, gastando 0 requisições)
  useEffect(() => {
    setMounted(true);
    let isMounted = true;
    async function loadInitial() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai-advisor");
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Erro ao consultar consultor solar");
        }
        const json: UnifiedAdvisorData = await res.json();
        if (isMounted) {
          setData(json);
        }
      } catch (err: any) {
        console.error("Falha ao carregar Consultor IA:", err);
        if (isMounted) {
          setError(err?.message || "Não foi possível conectar à IA.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitial();
    return () => {
      isMounted = false;
    };
  }, []);

  // Botão Regerar: força uma nova análise na API do Gemini
  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, nominalKwp }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Erro ao regerar análise");
      }
      const json: UnifiedAdvisorData = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Falha ao regerar Consultor IA:", err);
      setError(err?.message || "Erro ao regerar análise da IA.");
    } finally {
      setIsLoading(false);
    }
  };

  const activePeriodData = data ? (period === "daily" ? data.daily : data.monthly) : null;

  const modelLabel = data?.modelUsed
    ? data.modelUsed.replace(/^gemini-/, "Gemini ").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "IA Solar";

  const quotaBadgeText =
    data?.quotaCount !== undefined
      ? `${modelLabel} · ${data.quotaCount}/${data.maxPrimaryQuota ?? 4}`
      : modelLabel;

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "flashlight":
        return <RiFlashlightLine className="size-3.5" />;
      case "temp":
        return <RiTempHotLine className="size-3.5" />;
      case "compass":
        return <RiCompass3Line className="size-3.5" />;
      case "shield":
        return <RiShieldCheckLine className="size-3.5" />;
      case "dollar":
        return <RiMoneyDollarCircleLine className="size-3.5" />;
      case "tools":
      default:
        return <RiToolsLine className="size-3.5" />;
    }
  };

  const getIconColorClasses = (iconName: string) => {
    switch (iconName) {
      case "flashlight":
        return "bg-amber-500/10 text-amber-500";
      case "temp":
        return "bg-blue-500/10 text-blue-500";
      case "compass":
        return "bg-purple-500/10 text-purple-500";
      case "shield":
        return "bg-emerald-500/10 text-emerald-500";
      case "dollar":
        return "bg-emerald-500/10 text-emerald-500";
      case "tools":
      default:
        return "bg-cyan-500/10 text-cyan-500";
    }
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
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900 sm:text-base dark:text-gray-100">
                Consultor Energético IA
              </h2>
              <span
                title={
                  data?.switchedDueToQuota
                    ? "Limite de chamadas diárias do modelo primário atingido. Usando modelo alternativo do .env e reservando cota para o Raspberry."
                    : "Modelo inteligente configurado no .env"
                }
                className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400"
              >
                {quotaBadgeText}
              </span>
            </div>
          </div>
        </div>

        {/* Controles: Toggle Diário/Mensal (Instantâneo) + Botão Regerar */}
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
            disabled={!mounted ? false : isLoading}
            suppressHydrationWarning
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RiRefreshLine
              className={cx("size-3", isLoading && "animate-spin text-purple-500")}
              aria-hidden="true"
            />
            {isLoading ? "Consultando..." : "Regerar"}
          </button>
        </div>
      </div>

      {/* Alerta sutil se houver aviso de serviço */}
      {data?.warning && (
        <div className="mt-2 text-[11px] text-amber-500/90 dark:text-amber-400/90">
          ℹ️ {data.warning}
        </div>
      )}

      {/* Síntese Executiva Gerada pela IA */}
      <div className="relative mt-3.5 rounded-xl border border-purple-500/15 bg-purple-950/15 p-3.5 dark:border-purple-500/25 dark:bg-purple-950/25 min-h-[72px] flex items-center">
        {isLoading && !activePeriodData ? (
          <div className="w-full space-y-2 py-1">
            <div className="h-3 w-4/5 animate-pulse rounded bg-purple-500/20" />
            <div className="h-3 w-full animate-pulse rounded bg-purple-500/15" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-purple-500/10" />
          </div>
        ) : error && !activePeriodData ? (
          <p className="text-xs text-rose-500">
            {error}. Clique em &quot;Regerar&quot; para tentar novamente.
          </p>
        ) : activePeriodData ? (
          <p className="text-xs sm:text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            {activePeriodData.summary}
          </p>
        ) : (
          <div className="w-full space-y-2 py-1">
            <div className="h-3 w-4/5 animate-pulse rounded bg-purple-500/20" />
            <div className="h-3 w-full animate-pulse rounded bg-purple-500/15" />
          </div>
        )}
      </div>

      {/* Recomendações Diretas em Lista Limpa */}
      <div className="relative mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {isLoading && !activePeriodData ? (
          <>
            <div className="h-20 animate-pulse rounded-lg border border-gray-800 bg-gray-900/40" />
            <div className="h-20 animate-pulse rounded-lg border border-gray-800 bg-gray-900/40" />
            <div className="h-20 animate-pulse rounded-lg border border-gray-800 bg-gray-900/40" />
          </>
        ) : activePeriodData && activePeriodData.recommendations?.length > 0 ? (
          activePeriodData.recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-lg border border-gray-200/80 bg-white/60 p-2.5 text-xs dark:border-gray-800 dark:bg-gray-900/50"
            >
              <div
                className={cx(
                  "flex size-5 shrink-0 items-center justify-center rounded mt-0.5",
                  getIconColorClasses(rec.icon)
                )}
              >
                {renderIcon(rec.icon)}
              </div>
              <div className="min-w-0">
                <strong className="block text-gray-900 dark:text-gray-100">{rec.title}</strong>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {rec.description}
                </span>
              </div>
            </div>
          ))
        ) : null}
      </div>
    </div>
  );
}
