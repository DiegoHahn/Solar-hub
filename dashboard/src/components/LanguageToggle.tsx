"use client";

import { useI18n } from "@/i18n";
import { cx } from "@/lib/utils";
import { RiTranslate2 } from "@remixicon/react";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={cx(
        "flex items-center rounded-lg border border-gray-200 bg-gray-50/80 p-0.5 dark:border-gray-800 dark:bg-gray-900/60",
        className,
      )}
      role="group"
      aria-label={t.nav.language}
    >
      <div className="flex items-center pl-2 pr-1 text-gray-400 dark:text-gray-500">
        <RiTranslate2 className="size-3.5" aria-hidden="true" />
      </div>
      <button
        type="button"
        onClick={() => setLocale("pt-BR")}
        aria-pressed={locale === "pt-BR"}
        className={cx(
          "flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-all",
          locale === "pt-BR"
            ? "bg-white text-amber-600 shadow-xs dark:bg-gray-800 dark:text-amber-400"
            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
        )}
      >
        PT
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={cx(
          "flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-all",
          locale === "en"
            ? "bg-white text-amber-600 shadow-xs dark:bg-gray-800 dark:text-amber-400"
            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
        )}
      >
        EN
      </button>
    </div>
  );
}
