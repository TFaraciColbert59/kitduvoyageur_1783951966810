'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { KitSnapshot } from '../types/outdoorObjects.types';

export interface KitLiveCardProps {
  snapshot: KitSnapshot;
  isMine?: boolean;
  onPackMerge?: (kitId: string) => void;
  onOpenPackMerge?: (kitId: string) => void;
  onOpenKitDetails?: (kitId: string) => void;
}

function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1)} kg`;
  }
  return `${grams} g`;
}

export const KitLiveCard: React.FC<KitLiveCardProps> = React.memo(({
  snapshot,
  isMine = false,
  onPackMerge,
  onOpenPackMerge,
  onOpenKitDetails,
}) => {
  const { haptic } = useHapticFeedback();

  const handleCardClick = () => {
    haptic('light');
    onOpenKitDetails?.(snapshot.kitId);
  };

  const handleMergeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic('medium');
    if (onPackMerge) {
      onPackMerge(snapshot.kitId);
    } else if (onOpenPackMerge) {
      onOpenPackMerge(snapshot.kitId);
    }
  };

  const totalGrams = snapshot.totalWeightGrams || 1;

  return (
    <article
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      aria-label={`Kit : ${snapshot.title}`}
      className={`group relative my-1.5 flex w-full max-w-[300px] cursor-pointer flex-col overflow-hidden rounded-2xl border p-3.5 transition-all active:scale-[0.98] ${
        isMine
          ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]'
          : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)]'
      }`}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--lkv-forest-100)] opacity-80">
        Kit Voyageur
      </div>

      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold leading-tight">
            {snapshot.title || 'Inventaire matériel'}
          </h4>
          <span className="text-[11px] opacity-70">
            {snapshot.itemCount} objets
          </span>
        </div>

        <div className="shrink-0 text-right">
          <span className="font-mono text-sm font-extrabold tabular-nums text-[color:var(--lkv-action)]">
            {formatWeight(snapshot.totalWeightGrams)}
          </span>
        </div>
      </div>

      {/* Mini proportion category distribution bar */}
      {snapshot.categories && snapshot.categories.length > 0 && (
        <div className="mt-2.5">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
            {snapshot.categories.map((cat, i) => {
              const widthPct = Math.max(4, (cat.weightGrams / totalGrams) * 100);
              const colors = [
                'bg-[color:var(--lkv-primary)]',
                'bg-[color:var(--lkv-secondary)]',
                'bg-[color:var(--lkv-action)]',
                'bg-emerald-600',
              ];
              const colorClass = colors[i % colors.length];
              return (
                <div
                  key={cat.name}
                  style={{ width: `${widthPct}%` }}
                  title={`${cat.name}: ${formatWeight(cat.weightGrams)}`}
                  className={`${colorClass} transition-all`}
                />
              );
            })}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] opacity-70">
            <span className="truncate">
              {snapshot.categories.slice(0, 2).map((c) => c.name).join(', ')}
            </span>
            <span className="font-mono tabular-nums">
              {snapshot.categories.length} catégories
            </span>
          </div>
        </div>
      )}

      {/* Apple HIG 44px min touch target Pack Merge action button */}
      <button
        type="button"
        onClick={handleMergeClick}
        aria-label="Déclencher la répartition de charge Pack Merge"
        className="mt-3 flex h-[44px] min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] px-3 text-xs font-semibold text-[color:var(--lkv-action)] transition-all hover:bg-[color:var(--lkv-action)]/10 active:scale-[0.97]"
      >
        <Icon name="ArrowsRightLeftIcon" size={16} aria-hidden="true" />
        <span>Pack Merge</span>
      </button>
    </article>
  );
});

KitLiveCard.displayName = 'KitLiveCard';
