import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonChartCard,
  SkeletonKpiGrid,
  SkeletonPage,
  SkeletonPageHeader,
} from "@/components/Skeleton";

export default function PlacasLoading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader />
      <SkeletonChartCard chartClassName="h-64" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i} className="p-4 sm:p-4">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="mt-4 h-8 w-24" />
            <SkeletonBlock className="mt-3 h-2 w-full" />
            <SkeletonBlock className="mt-4 h-16 w-full" />
          </SkeletonCard>
        ))}
      </div>

      <SkeletonKpiGrid />
    </SkeletonPage>
  );
}
