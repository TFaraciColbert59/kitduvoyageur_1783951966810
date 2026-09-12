// Hub live (§4.5) — squelettes pré-formés : mêmes dimensions que le contenu
// réel (zéro CLS), surfaces glass + shimmer CSS (pattern ShimmerBlock).
// `motion-reduce:animate-none` fige le shimmer quand l'utilisateur réduit
// les animations : la structure reste, l'animation s'arrête.
import { cn } from '@/lib/utils';

export type ActivitySectionSkeletonVariant = 'timeline' | 'moments' | 'affiliate' | 'kit';

export interface ActivitySectionSkeletonProps {
  variant: ActivitySectionSkeletonVariant;
}

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-full bg-[var(--lkv-surface-muted)]',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent motion-reduce:animate-none"
        style={{ willChange: 'transform' }}
      />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          data-skeleton-item=""
          className="glass rounded-2xl min-h-[56px] p-3 flex items-center gap-3"
        >
          <ShimmerBar className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <ShimmerBar className="h-3.5 w-2/3" />
            <ShimmerBar className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MomentsSkeleton() {
  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          data-skeleton-item=""
          className="glass-pill h-9 w-24 shrink-0 flex items-center px-3"
        >
          <ShimmerBar className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function AffiliateSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          data-skeleton-item=""
          className="glass rounded-2xl min-h-[120px] p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <ShimmerBar className="h-5 w-24" />
            <ShimmerBar className="h-4 w-16" />
          </div>
          <ShimmerBar className="h-4 w-3/4" />
          <div className="h-9 w-full rounded-xl bg-[var(--lkv-surface-muted)]" />
        </div>
      ))}
    </div>
  );
}

function KitSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          data-skeleton-item=""
          className="glass rounded-2xl h-12 px-3 flex items-center gap-3"
        >
          <ShimmerBar className="h-5 w-5 shrink-0 rounded-full" />
          <ShimmerBar className="h-3.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function renderSkeleton(variant: ActivitySectionSkeletonVariant) {
  switch (variant) {
    case 'timeline':
      return <TimelineSkeleton />;
    case 'moments':
      return <MomentsSkeleton />;
    case 'affiliate':
      return <AffiliateSkeleton />;
    case 'kit':
      return <KitSkeleton />;
  }
}

export function ActivitySectionSkeleton({ variant }: ActivitySectionSkeletonProps) {
  return (
    <div aria-hidden="true" data-skeleton={variant}>
      {renderSkeleton(variant)}
    </div>
  );
}

export default ActivitySectionSkeleton;
