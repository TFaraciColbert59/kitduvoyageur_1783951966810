'use client';

import React, { useCallback, type KeyboardEvent } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface CapsuleTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Pastille ou compteur de notifications (ex: '8' messages non lus). */
  badge?: React.ReactNode | number | string;
}

export interface CapsuleTabsProps {
  items: readonly CapsuleTabItem[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  ariaLabel: string;
  className?: string;
  /** Taille de la capsule : 'default' (48 px) ou 'sm' (30 px). Défaut : 'default'. */
  size?: 'default' | 'sm';
  /** Positionnement : 'inline' (dans le flux) ou 'float' (flottante). Défaut : 'inline'. */
  placement?: 'inline' | 'float';
  /** Id DOM du bouton (utile au roving tabindex piloté par le parent). */
  idFor?: (id: string) => string;
  /**
   * Id du panneau contrôlé. Seul l'onglet actif reçoit `aria-controls` :
   * c'est le contrat des drawers (`SlotSelectorAria.test.tsx`).
   */
  panelIdFor?: (id: string) => string | undefined;
  /** Émet `data-slot={id}` sur chaque bouton (contrat du drawer Profil). */
  dataSlot?: boolean;
  /** Affiche le libellé sous l'icône (capsule de section, 9,5 px). */
  showLabels?: boolean;
  /** Déclenche une vibration haptique au changement d'onglet (défaut : true). */
  enableHaptics?: boolean;
}

/**
 * Capsule principale (48 px) ou secondaire (30 px) du design de référence LKDV Apple Liquid Glass.
 *
 * Grammaire unique, portée par `src/styles/liquid-capsules.css` :
 * - `size="default"` (48 px) : `.segc.lg-tabs.lens-on.lkdv-capsule` + lentille `.sel-lens`
 * - `size="sm"` (30 px) : `.lkdv-lens-float` + lentille `.ig-th.lens`
 * Lentille pilotée par `--i`, glissement 420 ms `var(--motion-ease-standard)`.
 *
 * Accessibilité : `role="tablist"`, `role="tab"`, `aria-selected`,
 * `aria-controls` sur l'actif seul, roving `tabIndex` (0 / -1),
 * flèches gauche/droite avec bouclage, `Home` / `End`.
 */
export function CapsuleTabs({
  items,
  activeIndex,
  onIndexChange,
  ariaLabel,
  className = '',
  size = 'default',
  placement = 'inline',
  idFor,
  panelIdFor,
  dataSlot = false,
  showLabels = false,
  enableHaptics = true,
}: CapsuleTabsProps) {
  const { haptic } = useHapticFeedback();
  const count = items.length;
  const safeIndex = count > 0 ? Math.max(0, Math.min(activeIndex, count - 1)) : 0;
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    let next = -1;
    if (event.key === 'ArrowRight') next = (safeIndex + 1) % count;
    else if (event.key === 'ArrowLeft') next = (safeIndex - 1 + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    if (next < 0) return;
    event.preventDefault();
    if (next !== safeIndex) {
      if (enableHaptics) haptic('selection');
      onIndexChange(next);
    }
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
            onClick={() => {
              if (!active) {
                if (enableHaptics) haptic('selection');
                onIndexChange(index);
              }
            }}
          >
            {item.icon ? <span className="ic s">{item.icon}</span> : null}
            {showLabels || !item.icon || (isSmall && hasLabels) ? (
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

export type SubCapsuleTabsProps = Omit<CapsuleTabsProps, 'size'>;

/**
 * SubCapsuleTabs — Capsule secondaire compacte 30 px avec lentille fluide.
 * Conforme à la grammaire Liquid Glass iOS 27 Apple.
 */
export function SubCapsuleTabs(props: SubCapsuleTabsProps) {
  return <CapsuleTabs size="sm" {...props} />;
}

export default CapsuleTabs;
