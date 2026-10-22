'use client';

import React, { useCallback, type KeyboardEvent } from 'react';

export interface CapsuleTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface CapsuleTabsProps {
  items: readonly CapsuleTabItem[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  ariaLabel: string;
  className?: string;
  /** Id DOM du bouton (utile au roving tabindex piloté par le parent). */
  idFor?: (id: string) => string;
  /**
   * Id du panneau contrôlé. Seul l'onglet actif reçoit `aria-controls` :
   * c'est le contrat des drawers (`SlotSelectorAria.test.tsx`).
   */
  panelIdFor?: (id: string) => string | undefined;
  /** Émet `data-slot={id}` sur chaque bouton (contrat du drawer Profil). */
  dataSlot?: boolean;
}

/**
 * Capsule principale 48 px du design de référence (`Compte / Profil`).
 *
 * Grammaire unique, portée par `src/styles/liquid-capsules.css` :
 * `.segc.lg-tabs.lens-on` + lentille `.sel-lens` pilotée par `--i`, glissement
 * 420 ms `cubic-bezier(.32,.72,0,1)`. Le composant ne porte aucune valeur
 * optique : il ne fait que produire le markup et l'interaction.
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
  idFor,
  panelIdFor,
  dataSlot = false,
}: CapsuleTabsProps) {
  const count = items.length;
  const safeIndex = count > 0 ? Math.max(0, Math.min(activeIndex, count - 1)) : 0;

  const focusTab = useCallback((index: number) => {
    const item = items[index];
    if (!item || typeof document === 'undefined') return;
    const id = idFor?.(item.id);
    if (!id) return;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
    });
  }, [items, idFor]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    let next = -1;
    if (event.key === 'ArrowRight') next = (safeIndex + 1) % count;
    else if (event.key === 'ArrowLeft') next = (safeIndex - 1 + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    if (next < 0) return;
    event.preventDefault();
    if (next !== safeIndex) onIndexChange(next);
    focusTab(next);
  };

  if (count === 0) return null;

  return (
    <div
      className={`segc lg-tabs lens-on lkdv-capsule ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      style={{ '--n': count } as React.CSSProperties}
    >
      <span
        className="sel-lens"
        aria-hidden="true"
        style={{ '--i': safeIndex } as React.CSSProperties}
      />
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
              if (!active) onIndexChange(index);
            }}
          >
            {item.icon ? (
              <span className="ic s">{item.icon}</span>
            ) : (
              <span className="lbl">{item.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default CapsuleTabs;
