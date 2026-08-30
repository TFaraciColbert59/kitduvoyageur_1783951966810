import { Skeleton } from '@/components/ui/Skeleton';

/** DepartCockpitSkeleton — skeleton reactif mobile/desktop pendant le chargement SSR. */
export function DepartCockpitSkeleton() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-3xl mx-auto px-3 sm:px-4 pb-3">
      {/* Header skeleton */}
      <div className="glass rounded-[28px] p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-52 sm:w-72" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="glass-sub-card p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-28" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 hidden sm:block" />
        </div>
      </div>

      {/* Preparation skeleton */}
      <div className="glass rounded-[28px] p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex gap-3">
          <Skeleton className="h-12 flex-1 rounded-2xl" />
          <Skeleton className="h-12 flex-1 rounded-2xl" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      {/* Checklist skeleton (desktop only) */}
      <div className="hidden md:block glass rounded-[28px] p-5 space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-md" />
            <Skeleton className={`h-4 ${i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-64' : 'w-56'}`} />
            <Skeleton className="h-4 w-12 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
