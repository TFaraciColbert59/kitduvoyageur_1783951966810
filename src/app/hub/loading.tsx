import { ShimmerLoader, ShimmerBlock } from '@/components/ui-layouts/shimmer-loader';

/**
 * Hub V4 — Squelette de chargement du MENU (stabilité de mise en page, zéro
 * CLS) : grille de cartes-onglets shimmer (UI Layouts, adapté).
 */
export default function HubLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement du hub">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`glass p-4 rounded-3xl min-h-[130px] ${i === 0 ? 'sm:col-span-2' : ''}`}
          >
            <div className="flex items-start justify-between">
              <span className="h-9 w-9 rounded-full bg-[var(--lkv-surface-muted)]" />
              <span className="h-4 w-4 rounded bg-[var(--lkv-surface-muted)]" />
            </div>
            <div className="mt-4 space-y-2">
              <ShimmerLoader rows={1} className="space-y-0">
                <ShimmerBlock className="w-1/2" />
              </ShimmerLoader>
              <ShimmerBlock className="w-4/5" />
              <ShimmerBlock className="w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}