"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n";

export function DemoBanner() {
  const pathname = usePathname();
  const { t } = useI18n();

  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <aside
      aria-label={t.demo.bannerNotice}
      className="sticky top-0 z-30 flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 backdrop-blur-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300"
    >
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
        {t.demo.bannerNotice}
      </span>
      <a
        href="/demo/sair"
        className="rounded px-2 py-0.5 font-semibold text-amber-800 underline transition-colors hover:bg-amber-500/20 dark:text-amber-200"
      >
        {t.demo.exitDemo}
      </a>
    </aside>
  );
}
