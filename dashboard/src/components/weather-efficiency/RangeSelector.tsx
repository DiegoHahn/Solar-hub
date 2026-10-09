"use client";

import { cx } from "@/lib/utils";
import type { WeatherRange } from "@/lib/weatherEfficiency";
import { useI18n } from "@/i18n";

interface RangeSelectorProps {
  range: WeatherRange;
  onChange: (range: WeatherRange) => void;
}

/** Segmented 7d | 30d | 90d control. */
export function RangeSelector({ range, onChange }: RangeSelectorProps) {
  const { t } = useI18n();
  const options: Array<{ value: WeatherRange; label: string }> = [
    { value: "7d", label: t.combined.days7 },
    { value: "30d", label: t.combined.days30 },
    { value: "90d", label: t.combined.days90 },
  ];

  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs">
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cx(
            "rounded-md px-2.5 py-1 font-semibold transition-colors",
            range === value
              ? "bg-white text-gray-900 shadow-sm dark:bg-purple-600 dark:text-white"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
