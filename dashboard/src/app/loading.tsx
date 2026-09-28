import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonChartCard,
  SkeletonKpiGrid,
  SkeletonPage,
  SkeletonPageHeader,
} from "@/components/Skeleton";

export default function HomeLoading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader />

      <SkeletonCard>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
          <SkeletonBlock className="size-40 rounded-full" />
          <div className="grid w-full gap-3 sm:max-w-xs">
            <SkeletonBlock className="h-14" />
            <SkeletonBlock className="h-14" />
            <SkeletonBlock className="h-14" />
          </div>
        </div>
      </SkeletonCard>

      <SkeletonKpiGrid />
      <SkeletonChartCard chartClassName="h-64" />
      <SkeletonCard>
        <SkeletonBlock className="h-4 w-40" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
        </div>
      </SkeletonCard>
      <SkeletonChartCard />
    </SkeletonPage>
  );
}
