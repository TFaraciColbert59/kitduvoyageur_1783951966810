'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SubTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface SubTabBarProps {
  tabs: SubTabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * SubTabBar — Plateau d'onglets secondaires flottant en verre liquide (Lot 2).
 * Conforme à la direction iOS 27 Liquid Glass : capsule 9999px isolée,
 * liseré spéculaire assombri, curseur G3 proéminent monochrome et zéro conflit tactile.
 */
export function SubTabBar({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  ariaLabel = 'Navigation secondaire',
}: SubTabBarProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-full p-1.5',
        'g1 border border-[color:var(--glass-rim)] shadow-lg backdrop-blur-xl',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            type="button"
            className={cn(
              'relative flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold',
              'select-none transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              isActive
                ? 'bg-[color:var(--g3-bg)] text-[color:var(--g3-text)] shadow-sm'
                : 'text-[color:var(--glass-secondary)] hover:text-[color:var(--glass-label)] hover:bg-white/[0.06]'
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge != null && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-bold',
                  isActive
                    ? 'bg-black/20 text-current'
                    : 'bg-white/10 text-[color:var(--glass-secondary)]'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SubTabBar;
