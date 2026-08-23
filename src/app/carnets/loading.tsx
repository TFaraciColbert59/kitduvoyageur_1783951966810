import { SkeletonCarnetCard } from '@/components/ui/Skeleton';

const S = ({ className = '' }: { className?: string }) => (
  <div className={`rounded-2xl bg-white/25 backdrop-blur-sm animate-pulse ${className}`} />
);

export default function CarnetsLoading() {
  return (
    <div className="max-w-[var(--page-max-w)] mx-auto px-4 pt-4 pb-24" aria-busy="true" aria-label="Chargement des carnets d'aventure…">
      {/* Header filter bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <S key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
        ))}
      </div>
      {/* Grid of carnets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonCarnetCard key={i} />
        ))}
      </div>
    </div>
  );
}
