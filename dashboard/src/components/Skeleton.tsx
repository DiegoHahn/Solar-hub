import { cx } from "@/lib/utils";

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-gray-200 dark:bg-gray-800/60", className)} />;
}

export function SkeletonCard({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cx(
        "w-full rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-900 dark:bg-[#090E1A] sm:p-6",
        className,
      )}
    >
      {children ?? (
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-3 w-64 max-w-full" />
        </div>
      )}
    </div>
  );
}

export function SkeletonChartCard({ chartClassName = "h-56" }: { chartClassName?: string }) {
  return (
    <SkeletonCard>
      <div className="flex items-center justify-between gap-3">
        <SkeletonBlock className="h-4 w-44" />
        <SkeletonBlock className="h-6 w-24" />
      </div>
      <SkeletonBlock className={cx("mt-4 w-full", chartClassName)} />
    </SkeletonCard>
  );
}

export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} className="min-h-[110px] p-4 sm:p-4">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="size-7 rounded-lg" />
          </div>
          <SkeletonBlock className="mt-4 h-7 w-24" />
        </SkeletonCard>
      ))}
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="space-y-2">
      <SkeletonBlock className="h-7 w-48" />
      <SkeletonBlock className="h-3 w-72 max-w-full" />
    </div>
  );
}

export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-8"
      role="status"
      aria-busy="true"
      aria-label="Carregando"
    >
      <span className="sr-only">Carregando…</span>
      {children}
    </main>
  );
}
