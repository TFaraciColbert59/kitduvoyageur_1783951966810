'use client';

import type { ReactNode } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface GroupeRailProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  ariaLabel: string;
  children: ReactNode;
}

/** Rail horizontal glass du groupe (snap + haptique) — même langage que Budget/Équipement. */
export function GroupeRail({
  title,
  subtitle,
  actionLabel = 'Tout voir',
  onAction,
  ariaLabel,
  children,
}: GroupeRailProps) {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <section aria-label={ariaLabel}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs font-medium text-[var(--lkv-text-primary)]/70">{subtitle}</p>
          )}
        </div>
        {onAction && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onAction();
            }}
            className="glass-capsule-btn min-h-[44px] shrink-0 !px-3 !py-1.5 text-[11px] font-bold"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <ul className="hub-hscroll -mx-4 flex list-none snap-x gap-3 overflow-x-auto px-4 pb-1">
        {children}
      </ul>
    </section>
  );
}

export default GroupeRail;
