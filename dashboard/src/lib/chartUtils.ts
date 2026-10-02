/* eslint-disable @typescript-eslint/no-explicit-any */

import type { MouseHandlerDataParam } from "recharts"

/**
 * Retorna o item de `data` sob o cursor/toque, a partir do índice ativo informado
 * nos eventos de mouse/toque do gráfico (`onClick`, `onMouseMove`).
 */
export function getActiveDatum<T>(
  state: MouseHandlerDataParam | null | undefined,
  data: readonly T[],
): T | undefined {
  const rawIndex = state?.activeIndex ?? state?.activeTooltipIndex
  if (rawIndex === null || rawIndex === undefined) return undefined
  const index = Number(rawIndex)
  return Number.isInteger(index) ? data[index] : undefined
}

export type ColorUtility = "bg" | "stroke" | "fill" | "text"

export const chartColors = {
  blue: {
    bg: "bg-blue-500",
    stroke: "stroke-blue-500",
    fill: "fill-blue-500",
    text: "text-blue-500",
  },
  emerald: {
    bg: "bg-emerald-500",
    stroke: "stroke-emerald-500",
    fill: "fill-emerald-500",
    text: "text-emerald-500",
  },
  violet: {
    bg: "bg-violet-500",
    stroke: "stroke-violet-500",
    fill: "fill-violet-500",
    text: "text-violet-500",
  },
  amber: {
    bg: "bg-amber-500",
    stroke: "stroke-amber-500",
    fill: "fill-amber-500",
    text: "text-amber-500",
  },
  gray: {
    bg: "bg-gray-500",
    stroke: "stroke-gray-500",
    fill: "fill-gray-500",
    text: "text-gray-500",
  },
  cyan: {
    bg: "bg-cyan-500",
    stroke: "stroke-cyan-500",
    fill: "fill-cyan-500",
    text: "text-cyan-500",
  },
  pink: {
    bg: "bg-pink-500",
    stroke: "stroke-pink-500",
    fill: "fill-pink-500",
    text: "text-pink-500",
  },
  lime: {
    bg: "bg-lime-500",
    stroke: "stroke-lime-500",
    fill: "fill-lime-500",
    text: "text-lime-500",
  },
  fuchsia: {
    bg: "bg-fuchsia-500",
    stroke: "stroke-fuchsia-500",
    fill: "fill-fuchsia-500",
    text: "text-fuchsia-500",
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string
  }
}

export type AvailableChartColorsKeys = keyof typeof chartColors

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(
  chartColors,
) as Array<AvailableChartColorsKeys>

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>()
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length])
  })
  return categoryColors
}

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: ColorUtility,
): string => {
  const fallbackColor = {
    bg: "bg-gray-500",
    stroke: "stroke-gray-500",
    fill: "fill-gray-500",
    text: "text-gray-500",
  }
  return chartColors[color]?.[type] ?? fallbackColor[type]
}

export const getYAxisDomain = (
  autoMinValue: boolean,
  minValue: number | undefined,
  maxValue: number | undefined,
) => {
  const minDomain = autoMinValue ? "auto" : (minValue ?? 0)
  const maxDomain = maxValue ?? "auto"
  return [minDomain, maxDomain]
}

export function hasOnlyOneValueForKey(
  array: any[],
  keyToCheck: string,
): boolean {
  const val: any[] = []

  for (const obj of array) {
    if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
      val.push(obj[keyToCheck])
      if (val.length > 1) {
        return false
      }
    }
  }

  return true
}

/**
 * Configuração de domínio e ticks para o eixo Y da curva de geração solar diária.
 * Mantém múltiplos inteiros limpos com passo de 5 kW e folga para a capacidade nominal,
 * eliminando truncamento de dígitos e sobreposição de rótulos.
 */
export function getSunCurveYAxisConfig(nominalCapKw: number = 16, dataMax: number = 0) {
  const peak = Math.max(nominalCapKw * 1.1, dataMax);
  const max = Math.max(20, Math.ceil(peak / 5) * 5);
  const step = 5;
  const ticks: number[] = [];
  for (let i = 0; i <= max; i += step) {
    ticks.push(i);
  }
  return {
    domain: [0, max] as [number, number],
    ticks,
  };
}

/**
 * Configuração de domínio e ticks para o eixo Y da curva de inversores individuais.
 * Garante múltiplos inteiros (passo de 2 kW) e folga acima do teto de 6 kW,
 * evitando cortes no topo do gráfico.
 */
export function getInverterCurveYAxisConfig(dataMax: number = 0) {
  const peak = Math.max(6, dataMax);
  const max = Math.max(8, Math.ceil((peak + 0.5) / 2) * 2);
  const step = 2;
  const ticks: number[] = [];
  for (let i = 0; i <= max; i += step) {
    ticks.push(i);
  }
  return {
    domain: [0, max] as [number, number],
    ticks,
  };
}

