"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  RiSunLine,
  RiCloudLine,
  RiRainyLine,
  RiThunderstormsLine,
  RiSunCloudyLine,
  RiContrastDropLine,
  RiSpeedUpLine,
  RiFlashlightLine,
} from "@remixicon/react";
import { Card } from "@/components/Card";
import { cx } from "@/lib/utils";
import { DailyWeather, fallbackDailyWeather } from "@/lib/weather";

interface WeatherEfficiencySectionProps {
  weatherData?: DailyWeather[];
  /** Versão compacta/enxuta para a aba Início (sem cards técnicos grandes de rodapé) */
  compact?: boolean;
}

export function WeatherEfficiencySection({
  weatherData = fallbackDailyWeather,
  compact = false,
}: WeatherEfficiencySectionProps) {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("7d");

  // Se for na Home (compact), mostra sempre os últimos 8 dias (7 anteriores + hoje)
  // Na aba de Análise: 7d (slice -8), 30d (slice -31), 90d (todo o array / slice -91)
  const displayedData = compact
    ? weatherData.slice(-8)
    : range === "7d"
    ? weatherData.slice(-8)
    : range === "30d"
    ? weatherData.slice(-31)
    : weatherData.slice(-91);

  const [activePoint, setActivePoint] = useState<DailyWeather>(
    displayedData[displayedData.length - 1] || weatherData[weatherData.length - 1]
  );

  // Ponto ativo corrente ajustado para o range atual
  const point = displayedData.find((d) => d.date === activePoint?.date) || displayedData[displayedData.length - 1];

  // Estatísticas do período exibido
  const totalKwh = displayedData.reduce((acc, d) => acc + d.estimatedKwh, 0);
  const totalRainMm = displayedData.reduce((acc, d) => acc + d.precipitationMm, 0);
  const avgHsp = (displayedData.reduce((acc, d) => acc + d.solarRadiationHsp, 0) / (displayedData.length || 1)).toFixed(2);
  const sunnyDays = displayedData.filter((d) => d.weatherCode <= 1).length;
  const partlyCloudyDays = displayedData.filter((d) => d.weatherCode >= 2 && d.weatherCode <= 48).length;
  const rainyDays = displayedData.filter((d) => d.weatherCode >= 50).length;

  const renderWeatherIcon = (icon: DailyWeather["icon"], className = "size-4") => {
    switch (icon) {
      case "sun":
        return <RiSunLine className={cx(className, "text-amber-500")} />;
      case "cloud-sun":
        return <RiSunCloudyLine className={cx(className, "text-amber-400")} />;
      case "cloud":
        return <RiCloudLine className={cx(className, "text-gray-400")} />;
      case "rain":
        return <RiRainyLine className={cx(className, "text-blue-400")} />;
      case "storm":
        return <RiThunderstormsLine className={cx(className, "text-purple-400")} />;
    }
  };

  return (
    <Card className={cx("p-4 sm:p-5", !compact && "sm:p-6")}>
      {/* Cabeçalho da Seção */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900 sm:text-base dark:text-gray-100">
            {compact ? "Sol vs. Geração (Últimos 7 dias)" : "Índice Climático vs. Eficiência Solar"}
          </h2>
          {!compact && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              Open-Meteo · Içara/SC
            </span>
          )}
        </div>

        {/* Na aba Análise: Seletor 7 Dias | 30 Dias | 90 Dias */}
        {!compact && (
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs">
            <button
              type="button"
              onClick={() => setRange("7d")}
              className={cx(
                "rounded-md px-2.5 py-1 font-semibold transition-colors",
                range === "7d"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-purple-600 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              7 Dias
            </button>
            <button
              type="button"
              onClick={() => setRange("30d")}
              className={cx(
                "rounded-md px-2.5 py-1 font-semibold transition-colors",
                range === "30d"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-purple-600 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              30 Dias
            </button>
            <button
              type="button"
              onClick={() => setRange("90d")}
              className={cx(
                "rounded-md px-2.5 py-1 font-semibold transition-colors",
                range === "90d"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-purple-600 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              90 Dias
            </button>
          </div>
        )}
      </div>

      {/* Banner Superior de Inspeção Dinâmica: Distribuído Horizontalmente */}
      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 sm:p-3 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="flex items-center justify-between gap-2">
          {/* Lado Esquerdo: Clima do dia */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-gray-800">
              {renderWeatherIcon(point.icon, "size-4")}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">
                  {point.dayOfWeek}, {point.formattedDate}
                </span>
                <span className="rounded bg-gray-200/80 px-1.5 py-0.2 text-[10px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300 truncate max-w-[110px] sm:max-w-none">
                  {point.condition}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {point.tempMin}°C ~ {point.tempMax}°C
                {point.precipitationMm > 0 ? ` · ${point.precipitationMm} mm` : ""}
              </p>
            </div>
          </div>

          {/* Lado Direito: Métricas chave ocupando o espaço livre */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 text-right">
            <div>
              <span className="block text-[10px] text-gray-500 dark:text-gray-400">Geração</span>
              <strong className="text-xs sm:text-base font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {point.estimatedKwh.toFixed(1)} <span className="text-[10px] font-normal text-gray-500">kWh</span>
              </strong>
            </div>
            <div>
              <span className="block text-[10px] text-gray-500 dark:text-gray-400">Sol (HSP)</span>
              <strong className="text-xs sm:text-base font-extrabold text-cyan-600 dark:text-cyan-400 tabular-nums">
                {point.solarRadiationHsp.toFixed(1)} <span className="text-[10px] font-normal text-gray-500">h</span>
              </strong>
            </div>
            <div>
              <span className="block text-[10px] text-gray-500 dark:text-gray-400">Eficiência</span>
              <strong className="text-xs sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {((point.estimatedKwh / (16.0 * (point.solarRadiationHsp || 1))) * 100).toFixed(0)}%
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico Composto: Geração (Barra Âmbar) vs Irradiação HSP (Linha Ciano) */}
      <div className="mt-3 h-48 sm:h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={displayedData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            onMouseMove={(state: any) => {
              if (state?.activePayload?.[0]?.payload) {
                setActivePoint(state.activePayload[0].payload as DailyWeather);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="formattedDate"
              tickLine={false}
              axisLine={false}
              interval={range === "90d" && !compact ? 14 : range === "30d" && !compact ? 4 : 0}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
            />
            {/* Eixo Esquerdo: Geração (kWh) */}
            <YAxis
              yAxisId="kwh"
              domain={[0, 80]}
              ticks={[0, 20, 40, 60, 80]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(v) => `${v}`}
              width={24}
            />
            {/* Eixo Direito: Irradiação HSP (h) */}
            <YAxis
              yAxisId="hsp"
              orientation="right"
              domain={[0, 8]}
              ticks={[0, 2, 4, 6, 8]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#06b6d4", fontSize: 11 }}
              tickFormatter={(v) => `${v}h`}
              width={24}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const p = payload[0].payload as DailyWeather;
                  return (
                    <div className="hidden md:block rounded-xl border border-gray-800 bg-gray-950/95 p-3 text-xs text-gray-100 shadow-2xl backdrop-blur-md">
                      <div className="flex items-center gap-1.5 font-bold text-gray-200">
                        {renderWeatherIcon(p.icon)}
                        <span>{p.dayOfWeek}, {p.formattedDate} — {p.condition}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between gap-4 text-amber-400">
                          <span>Geração da usina:</span>
                          <strong>{p.estimatedKwh} kWh</strong>
                        </div>
                        <div className="flex justify-between gap-4 text-cyan-400">
                          <span>Irradiação solar (HSP):</span>
                          <strong>{p.solarRadiationHsp} h (kWh/m²)</strong>
                        </div>
                        <div className="flex justify-between gap-4 text-gray-400">
                          <span>Horas de sol pleno:</span>
                          <strong>{p.sunshineHours} h</strong>
                        </div>
                        <div className="flex justify-between gap-4 text-blue-400">
                          <span>Chuva registrada:</span>
                          <strong>{p.precipitationMm} mm</strong>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <defs>
              <linearGradient id="solarAmberGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {/* Visualização de Geração: Em 90d usa Linha/Área para evitar poluição de 90 barras; em 7d e 30d usa Barras */}
            {range === "90d" && !compact ? (
              <Area
                yAxisId="kwh"
                type="monotone"
                dataKey="estimatedKwh"
                name="Geração (kWh)"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#solarAmberGrad)"
                dot={false}
              />
            ) : (
              <Bar
                yAxisId="kwh"
                dataKey="estimatedKwh"
                name="Geração (kWh)"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                maxBarSize={range === "30d" && !compact ? 14 : 36}
              />
            )}

            {/* Linha de Irradiação Solar HSP */}
            <Line
              yAxisId="hsp"
              type="monotone"
              dataKey="solarRadiationHsp"
              name="Irradiação HSP (h)"
              stroke="#06b6d4"
              strokeWidth={range === "90d" && !compact ? 1.5 : range === "30d" && !compact ? 2 : 3}
              dot={range === "7d" || compact ? { r: 4, fill: "#06b6d4" } : false}
              activeDot={{ r: 6, fill: "#22d3ee" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda simples */}
      <div className="mt-2 flex items-center justify-center gap-6 border-t border-gray-100 pt-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          {range === "90d" && !compact ? (
            <span className="h-0.5 w-3 bg-amber-500" />
          ) : (
            <span className="size-2.5 rounded-sm bg-amber-500" />
          )}
          <span>Geração Real (kWh/dia)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-cyan-500" />
          <span>Irradiação Solar (HSP em h)</span>
        </div>
      </div>

      {/* Resumo Climático Histórico (30 ou 90 Dias): Focado nos dias de sol, nuvens e geração */}
      {!compact && (range === "30d" || range === "90d") && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-center dark:border-amber-500/30 dark:bg-amber-950/20">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <RiSunLine className="size-3.5" />
              Dias de Sol
            </div>
            <div className="mt-0.5 text-lg font-bold text-amber-600 dark:text-amber-400">
              {sunnyDays} <span className="text-xs font-normal text-gray-500">dias</span>
            </div>
            <p className="text-[10px] text-gray-500">Céu limpo / pleno</p>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 text-center dark:border-blue-500/30 dark:bg-blue-950/20">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              <RiSunCloudyLine className="size-3.5" />
              Sol c/ Nuvens
            </div>
            <div className="mt-0.5 text-lg font-bold text-blue-600 dark:text-blue-400">
              {partlyCloudyDays} <span className="text-xs font-normal text-gray-500">dias</span>
            </div>
            <p className="text-[10px] text-gray-500">Parcialmente nublado</p>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-2.5 text-center dark:border-cyan-500/30 dark:bg-cyan-950/20">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
              <RiRainyLine className="size-3.5" />
              Dias com Chuva
            </div>
            <div className="mt-0.5 text-lg font-bold text-cyan-600 dark:text-cyan-400">
              {rainyDays} <span className="text-xs font-normal text-gray-500">dias</span>
            </div>
            <p className="text-[10px] text-gray-500">{totalRainMm.toFixed(0)} mm acumulados</p>
          </div>

          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-2.5 text-center dark:border-purple-500/30 dark:bg-purple-950/20">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
              <RiFlashlightLine className="size-3.5" />
              {range === "90d" ? "Geração 90 Dias" : "Geração do Mês"}
            </div>
            <div className="mt-0.5 text-lg font-bold text-purple-600 dark:text-purple-400">
              {totalKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-xs font-normal text-gray-500">kWh</span>
            </div>
            <p className="text-[10px] text-gray-500">Média {avgHsp} h/dia HSP</p>
          </div>
        </div>
      )}

      {/* Na aba Análise (quando não for compact), exibe os cards de diagnóstico do período */}
      {!compact && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <RiSpeedUpLine className="size-4" />
            </div>
            <div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Performance Ratio (PR)</span>
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                81,4% <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">(Excelente)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <RiContrastDropLine className="size-4" />
            </div>
            <div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {range === "90d"
                  ? "Perda por Nebulosidade (90d)"
                  : range === "30d"
                  ? "Perda por Nebulosidade (30d)"
                  : "Perda por Nebulosidade (7d)"}
              </span>
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {range === "90d" ? "~415 kWh" : range === "30d" ? "~142 kWh" : "~38,2 kWh"}{" "}
                <span className="text-xs font-normal text-gray-500">
                  {range === "90d" ? "(no trimestre)" : range === "30d" ? "(no mês)" : "(na semana)"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <RiSunLine className="size-4" />
            </div>
            <div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {range === "90d"
                  ? "Média HSP Trimestre (90d)"
                  : range === "30d"
                  ? "Média HSP Mês (30d)"
                  : "Média HSP Semana (7d)"}
              </span>
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {avgHsp} h/dia <span className="text-xs font-normal text-gray-500">(Sol Pleno)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
