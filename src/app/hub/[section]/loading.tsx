import { Card } from '@/components/ui';
import { ShimmerBlock, ShimmerLoader } from '@/components/ui-layouts/shimmer-loader';

/** Hub V4 — Squelette shimmer d'une section (stabilité, zéro CLS). */
export default function HubSectionLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement de la section">
      <ShimmerBlock className="h-4 w-20" />
      <ShimmerBlock className="h-7 w-44" />
      <Card className="space-y-3">
        <ShimmerLoader rows={3} />
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="space-y-3">
            <ShimmerLoader rows={2} />
          </Card>
        ))}
      </div>
    </div>
  );
}