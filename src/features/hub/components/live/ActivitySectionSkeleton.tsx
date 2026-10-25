// Hub live (§4.5) — squelettes pré-formés : mêmes dimensions que le contenu
// réel (zéro CLS), surfaces canoniques + shimmer tokenisé (ShimmerBlock).
// `motion-reduce:animate-none` fige le shimmer quand l'utilisateur réduit
// les animations : la structure reste, l'animation s'arrête.
import { Card } from '@/components/ui';
import { ShimmerBlock } from '@/components/ui-layouts/shimmer-loader';

export type ActivitySectionSkeletonVariant = 'timeline' | 'moments' | 'affiliate' | 'kit';

export interface ActivitySectionSkeletonProps {
  variant: ActivitySectionSkeletonVariant;
}

function TimelineSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Card
          key={i}
          variant="compact"
          data-skeleton-item=""
          className="flex min-h-[56px] items-center gap-3"
        >
          <ShimmerBlock className="motion-reduce:animate-none h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <ShimmerBlock className="motion-reduce:animate-none h-3.5 w-2/3" />
            <ShimmerBlock className="motion-reduce:animate-none h-3 w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function MomentsSkeleton() {
  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map((i) => (
        <Card
          key={i}
          variant="compact"
          data-skeleton-item=""
          className="flex h-9 w-24 shrink-0 items-center rounded-full px-3"
        >
          <ShimmerBlock className="motion-reduce:animate-none h-3 w-16" />
        </Card>
      ))}
    </div>
  );
}

function AffiliateSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[0, 1].map((i) => (
        <Card
          key={i}
          variant="compact"
          data-skeleton-item=""
          className="min-h-[120px] space-y-3 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <ShimmerBlock className="motion-reduce:animate-none h-5 w-24" />
            <ShimmerBlock className="motion-reduce:animate-none h-4 w-16" />
          </div>
          <ShimmerBlock className="motion-reduce:animate-none h-4 w-3/4" />
          <div className="h-9 w-full rounded-xl bg-[var(--lkv-surface-muted)]" />
        </Card>
      ))}
    </div>
  );
}

function KitSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <Card
          key={i}
          variant="compact"
          data-skeleton-item=""
          className="flex h-12 items-center gap-3 px-3"
        >
          <ShimmerBlock className="motion-reduce:animate-none h-5 w-5 shrink-0 rounded-full" />
          <ShimmerBlock className="motion-reduce:animate-none h-3.5 w-1/2" />
        </Card>
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
