import { ShimmerBlock, ShimmerLoader } from '@/components/ui-layouts/shimmer-loader';

/** Hub V4 — Squelette shimmer d'une section (stabilité, zéro CLS). */
export default function HubSectionLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement de la section">
      <ShimmerBlock className="h-4 w-20" />
      <ShimmerBlock className="h-7 w-44" />
      <div className="glass rounded-3xl p-5 space-y-3">
        <ShimmerLoader rows={3} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass rounded-3xl p-5 space-y-3">
            <ShimmerLoader rows={2} />
          </div>
        ))}
      </div>
    </div>
  );
}