"use client";

import { useEffect } from "react";
import type { DailyWeather } from "@/lib/weather";
import { formatWeatherDate } from "@/lib/weatherEfficiency";
import { useI18n, formatNumber, type Locale } from "@/i18n";

interface CustomWeatherTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DailyWeather }>;
  onActivePoint?: (point: DailyWeather) => void;
  renderIcon: (icon: DailyWeather["icon"], className?: string) => React.ReactNode;
  locale?: Locale;
}

export function WeatherTooltip({ active, payload, onActivePoint, renderIcon, locale = "pt-BR" }: CustomWeatherTooltipProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (active && payload && payload.length > 0 && onActivePoint) {
      const p = payload[0]?.payload;
      if (p) {
        onActivePoint(p);
      }
    }
  }, [active, payload, onActivePoint]);

  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  const { dayOfWeek, formattedDate } = formatWeatherDate(p.date, locale);
  const conditionLabel = t.weather[p.conditionKey];

  return (
    <div className="hidden md:block rounded-xl border border-gray-800 bg-gray-950/95 p-3 text-xs text-gray-100 shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-1.5 font-bold text-gray-200">
        {renderIcon(p.icon)}
        <span>{dayOfWeek}, {formattedDate} — {conditionLabel}</span>
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex justify-between gap-4 text-amber-400">
          <span>{p.isReal ? t.combined.tooltipRealGeneration : t.combined.tooltipEstimatedGeneration}</span>
          <strong>{formatNumber(p.estimatedKwh, locale, { minimumFractionDigits: 1 })} kWh</strong>
        </div>
        <div className="flex justify-between gap-4 text-cyan-400">
          <span>{t.combined.tooltipSolarIrradiation}</span>
          <strong>{formatNumber(p.solarRadiationHsp, locale, { minimumFractionDigits: 1 })} h (kWh/m²)</strong>
        </div>
        <div className="flex justify-between gap-4 text-gray-400">
          <span>{t.combined.tooltipSunshineHours}</span>
          <strong>{formatNumber(p.sunshineHours, locale, { minimumFractionDigits: 1 })} h</strong>
        </div>
        <div className="flex justify-between gap-4 text-blue-400">
          <span>{t.combined.tooltipPrecipitation}</span>
          <strong>{formatNumber(p.precipitationMm, locale)} mm</strong>
        </div>
      </div>
    </div>
  );
}
