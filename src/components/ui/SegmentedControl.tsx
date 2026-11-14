'use client';

import React, { useCallback, type KeyboardEvent } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface SegmentedControlItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode | number | string;
}

export interface SegmentedControlProps {
  items: readonly SegmentedControlItem[];
  activeIndex?: number;
  value?: string;
  onIndexChange?: (index: number) => void;
  onChange?: (id: string) => void;
  ariaLabel: string;
  className?: string;
  size?: 'default' | 'sm';
  placement?: 'inline' | 'float';
  idFor?: (id: string) => string;
  panelIdFor?: (id: string) => string | undefined;
  dataSlot?: boolean;
  showLabels?: boolean;
  enableHaptics?: boolean;
}

/**
 * SegmentedControl — Contrôle segmenté canonique LKDV Liquid Glass (Lot 2).
 *
 * Combine les tailles 'default' (48 px) et 'sm' (30 px) avec l'indicateur
 * de verre glissant Apple HIG (.sel-lens / .ig-th.lens) piloté par --n et --i.
 * Support complet WAI-ARIA : tablist, tab, roving tabIndex, navigation clavier.
 */
export function SegmentedControl({
  items,
  activeIndex,
  value,
  onIndexChange,
  onChange,
  ariaLabel,
  className = '',
  size = 'default',
  placement = 'inline',
  idFor,
  panelIdFor,
  dataSlot = false,
  showLabels = false,
  enableHaptics = true,
}: SegmentedControlProps) {
  const { haptic } = useHapticFeedback();
  const count = items.length;

  let computedIndex = 0;
  if (typeof activeIndex === 'number') {
    computedIndex = activeIndex;
  } else if (typeof value === 'string') {
    const found = items.findIndex((it) => it.id === value);
    if (found >= 0) computedIndex = found;
  }
  const safeIndex = count > 0 ? Math.max(0, Math.min(computedIndex, count - 1)) : 0;
  const hasLabels = items.some((item) => Boolean(item.label));

  const focusTab = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item || typeof document === 'undefined') return;
      const id = idFor?.(item.id);
      if (!id) return;
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.focus();
      });
    },
    [items, idFor]
  );

  const handleSelect = (index: number) => {
    if (index === safeIndex) return;
    if (enableHaptics) haptic('selection');
    onIndexChange?.(index);
    if (items[index]) {
      onChange?.(items[index].id);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    let next = -1;
    if (event.key === 'ArrowRight') next = (safeIndex + 1) % count;
    else if (event.key === 'ArrowLeft') next = (safeIndex - 1 + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    if (next < 0) return;
    event.preventDefault();
    handleSelect(next);
    focusTab(next);
  };

  if (count === 0) return null;

  const isSmall = size === 'sm';
  const containerClass = isSmall
    ? `lkdv-lens-float ${placement === 'inline' ? 'is-inline' : ''} ${hasLabels ? 'has-labels' : ''} ${className}`.trim()
    : `segc lg-tabs lens-on lkdv-capsule ${className}`.trim();

  return (
    <div
      className={containerClass}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      style={{ '--n': count } as React.CSSProperties}
    >
      {isSmall ? (
        <span
          className="ig-th lens"
          aria-hidden="true"
          style={{ '--i': safeIndex } as React.CSSProperties}
        />
      ) : (
        <span
          className="sel-lens"
          aria-hidden="true"
          style={{ '--i': safeIndex } as React.CSSProperties}
        />
      )}
      {items.map((item, index) => {
        const active = index === safeIndex;
        return (
          <button
            key={item.id}
            id={idFor?.(item.id)}
            type="button"
            role="tab"
            className={active ? 'active' : ''}
            aria-selected={active}
            aria-controls={active ? panelIdFor?.(item.id) : undefined}
            aria-label={item.label}
            title={item.label}
            data-slot={dataSlot ? item.id : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => handleSelect(index)}
          >
            {item.icon ? <span className="ic s">{item.icon}</span> : null}
            {showLabels ? (
              <span className="lbl">{item.label}</span>
            ) : !item.icon ? (
              <span className="lbl">{item.label}</span>
            ) : null}
            {item.badge != null && (
              <span className="badge-count" aria-hidden="true">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
