import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonChartCard,
  SkeletonPage,
  SkeletonPageHeader,
} from "@/components/Skeleton";

export default function AnaliseLoading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader />

      <SkeletonCard>
        <div className="flex items-center justify-between gap-3">
          <SkeletonBlock className="h-5 w-48" />
          <SkeletonBlock className="h-8 w-40" />
        </div>
        <div className="mt-4 space-y-2">
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-11/12" />
          <SkeletonBlock className="h-3 w-4/5" />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
        </div>
      </SkeletonCard>

      <SkeletonCard>
        <SkeletonBlock className="h-4 w-44" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-32" />
        </div>
      </SkeletonCard>

      <SkeletonChartCard chartClassName="h-64" />
    </SkeletonPage>
  );
}
