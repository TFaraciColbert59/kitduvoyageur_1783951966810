import { ShimmerLoader, ShimmerBlock } from '@/components/ui-layouts/shimmer-loader';

const SPANS = [6, 6, 4, 4, 4, 3, 3, 3, 3] as const;

const SPAN_CLASS: Record<number, string> = {
  6: 'sm:col-span-2 lg:col-span-6',
  4: 'sm:col-span-1 lg:col-span-4',
  3: 'sm:col-span-1 lg:col-span-3',
};

/**
 * Hub V4 — Squelette du MENU (disposition BENTO) : mêmes spans que la grille
 * réelle, cellules shimmer — stabilité de mise en page, zéro CLS.
 */
export default function HubLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement du hub">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
        {SPANS.map((span, i) => (
          <div key={i} className={`glass rounded-3xl min-h-[120px] p-4 ${SPAN_CLASS[span]}`}>
            <div className="flex items-start justify-between">
              <span className="h-9 w-9 rounded-full bg-[var(--lkv-surface-muted)]" />
              <span className="h-4 w-4 rounded bg-[var(--lkv-surface-muted)]" />
            </div>
            <div className="mt-4 space-y-2">
              <ShimmerLoader rows={1} className="space-y-0">
                <ShimmerBlock className="w-1/2" />
              </ShimmerLoader>
              <ShimmerBlock className="w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}