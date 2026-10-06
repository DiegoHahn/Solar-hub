import { Card } from "@/components/Card";
import { cx } from "@/lib/utils";
import type { RemixiconComponentType } from "@remixicon/react";

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon: RemixiconComponentType;
  accent?: "blue" | "emerald" | "amber" | "violet" | "neutral";
  /** State indicating missing or unreliable current data (e.g., collector offline) — dampens visual emphasis. */
  dim?: boolean;
}

const accentClasses: Record<NonNullable<StatCardProps["accent"]>, { icon: string; bg: string }> = {
  blue: {
    icon: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  emerald: {
    icon: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    icon: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  violet: {
    icon: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  neutral: {
    icon: "text-gray-400 dark:text-gray-400",
    bg: "bg-gray-500/10 text-gray-500 dark:text-gray-400",
  },
};

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  accent = "blue",
  dim = false,
}: StatCardProps) {
  const styles = accentClasses[accent] || accentClasses.blue;

  return (
    <Card className="flex flex-col justify-between p-4 h-full min-h-[110px] transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-800">
      {/* Card Top: Label on left, Icon on right */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <div
          className={cx(
            "flex size-7 shrink-0 items-center justify-center rounded-lg",
            dim ? "bg-gray-800/60 text-gray-500" : styles.bg
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>

      {/* Main Value + Unit */}
      <div className="mt-3">
        <div className="flex items-baseline gap-1.5 flex-nowrap">
          <span
            className={cx(
              "text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap",
              dim ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-gray-50"
            )}
          >
            {value}
          </span>
          {unit && (
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 shrink-0">
              {unit}
            </span>
          )}
        </div>

        {/* Subtitle / Explanatory hint */}
        {hint && (
          <p className="mt-1 text-[11px] leading-tight text-gray-400 dark:text-gray-500">
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}
