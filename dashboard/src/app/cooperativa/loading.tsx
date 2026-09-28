import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonChartCard,
  SkeletonKpiGrid,
  SkeletonPage,
  SkeletonPageHeader,
} from "@/components/Skeleton";

export default function CooperativaLoading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader />

      <SkeletonCard className="rounded-2xl">
        <SkeletonBlock className="h-3 w-36" />
        <SkeletonBlock className="mt-4 h-10 w-48" />
        <SkeletonBlock className="mt-3 h-3 w-64 max-w-full" />
      </SkeletonCard>

      <SkeletonKpiGrid />
      <SkeletonChartCard chartClassName="h-64" />

      <SkeletonCard>
        <SkeletonBlock className="h-4 w-40" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonBlock key={i} className="h-12 w-full" />
          ))}
        </div>
      </SkeletonCard>
    </SkeletonPage>
  );
}
