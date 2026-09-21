import { Skeleton, SkeletonCarnetCard } from '@/components/ui/Skeleton';

export default function CarnetsLoading() {
  return (
    <div className="mx-auto max-w-[var(--page-max-w)] px-[var(--space-4)] pb-24 pt-[var(--space-4)]" aria-busy="true" aria-label="Chargement des carnets d'aventure…">
      <div className="flex gap-[var(--space-2)] overflow-x-auto pb-[var(--space-3)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-[var(--space-4)] grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonCarnetCard key={i} />
        ))}
      </div>
    </div>
  );
}
