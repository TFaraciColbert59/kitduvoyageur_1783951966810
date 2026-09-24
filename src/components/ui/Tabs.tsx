'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type TabsVariant = 'segmented' | 'scrollable';

export interface TabOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  /** Pastille libre (score, libellé) — prioritaire sur `count`. */
  badge?: React.ReactNode;
}

export interface TabsProps {
  options: readonly TabOption[];
  value: string;
  onChange: (id: string) => void;
  /**
   * `segmented` = contrôle local (2 à 5 choix exclusifs).
   * `scrollable` = filtres/catégories en défilement horizontal.
   */
  variant?: TabsVariant;
  ariaLabel?: string;
  className?: string;
}

/**
 * Tabs — système unique (Phase 2, Lot 3).
 * Un seul composant pour les contrôles segmentés et les filtres défilants ;
 * les features ne recréent plus leur propre contrôle.
 */
export function Tabs({
  options,
  value,
  onChange,
  variant = 'segmented',
  ariaLabel = 'Filtres',
  className,
}: TabsProps) {
  const baseItem =
    'inline-flex shrink-0 items-center justify-center gap-[var(--space-1)] font-semibold transition-colors duration-[var(--motion-control-duration)] ease-[var(--motion-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

  // Navigation clavier WAI-ARIA : flèches gauche/droite dans la tablist.
  const handleArrowKeys = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const dir = event.key === 'ArrowRight' ? 1 : -1;
    const next = (index + dir + options.length) % options.length;
    onChange(options[next].id);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  if (variant === 'scrollable') {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          'flex w-full items-center gap-[var(--space-2)] overflow-x-auto pb-[var(--space-1)]',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          className
        )}
      >
        {options.map((option, index) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              onKeyDown={(event) => handleArrowKeys(event, index)}
              onClick={() => onChange(option.id)}
              className={cn(
                baseItem,
                'min-h-[var(--control-height-sm)] rounded-full px-[var(--space-4)] text-[length:var(--lkv-text-footnote)]',
                active
                  ? 'bg-[var(--g3-bg)] text-[var(--g3-text)] shadow-[var(--glass-rim)] font-bold'
                  : 'bg-[var(--g2-bg)] border border-[color:var(--glass-border-color)] text-[var(--glass-label-secondary)] shadow-[var(--glass-rim)] hover:text-[var(--glass-label)]'
              )}
            >
              {option.icon}
              {option.label}
              {option.badge ?? (typeof option.count === 'number' && option.count > 0 && (
                <span className="ml-[var(--space-1)] rounded-full bg-black/10 px-[6px] text-[length:var(--lkv-text-caption-2)]">
                  {option.count > 9 ? '9+' : option.count}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex w-full items-center gap-[var(--space-1)] rounded-full border border-[color:var(--glass-border-color)] bg-[var(--g1-bg)] backdrop-blur-md p-[3px]',
        className
      )}
    >
      {options.map((option, index) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onKeyDown={(event) => handleArrowKeys(event, index)}
            onClick={() => onChange(option.id)}
            className={cn(
              baseItem,
              'min-h-[var(--control-height-sm)] flex-1 rounded-full px-[var(--space-3)] text-[length:var(--lkv-text-footnote)] transition-all duration-[var(--motion-control-duration)]',
              active
                ? 'bg-[var(--g3-bg)] text-[var(--g3-text)] shadow-[var(--glass-rim)] font-bold'
                : 'text-[var(--glass-label-secondary)] hover:text-[var(--glass-label)]'
            )}
          >
            {option.icon}
            {option.label}
            {option.badge ?? (typeof option.count === 'number' && option.count > 0 && (
              <span className="ml-[var(--space-1)] rounded-full bg-black/10 px-[6px] text-[length:var(--lkv-text-caption-2)]">
                {option.count > 9 ? '9+' : option.count}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
