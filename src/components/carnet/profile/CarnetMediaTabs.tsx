'use client';

import React, { useRef } from 'react';

export interface CarnetMediaTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface CarnetMediaTabsProps {
  items: CarnetMediaTab[];
  /** Index actif ; `-1` = aucun segment sélectionné (page hors sélecteur). */
  activeIndex: number;
  onChange: (index: number) => void;
  ariaLabel: string;
  /** Préfixe des ids des boutons (`carnet-page-tab` par défaut). */
  idPrefix?: string;
  /**
   * Id du panneau contrôlé. Par défaut `carnet-page-${id}`, le panneau du
   * carrousel ; `() => undefined` quand les volets n'ont pas de `tabpanel`.
   */
  panelIdFor?: (id: string) => string | undefined;
  /**
   * Segment avec libellé visible (sélecteur 44 px du drawer) : icône puis
   * libellé. Absent, le segment reste une icône seule, comme sur la carte.
   */
  showLabel?: boolean;
}

/**
 * Sélecteur 88 × 30 du Compte (`.ig-tabs`) : deux segments de 41,5 × 25, la
 * lentille blanche n'est pas peinte ici. Elle est rendue une seule fois par
 * `CarnetCard` (`.ckp-capsule > .ckp-th`), au-dessus du seul segment actif.
 *
 * Clavier : flèches gauche/droite avec bouclage, `Home`, `End`, roving
 * `tabIndex`, `aria-selected` et `aria-controls` sur l'actif.
 */
export function CarnetMediaTabs({
  items,
  activeIndex,
  onChange,
  ariaLabel,
  idPrefix = 'carnet-page-tab',
  panelIdFor = (id) => `carnet-page-${id}`,
  showLabel = false,
}: CarnetMediaTabsProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const count = items.length;
  const safeIndex = count > 0 ? (activeIndex < 0 ? -1 : Math.max(0, Math.min(activeIndex, count - 1))) : -1;

  const select = (index: number) => {
    if (index === safeIndex) return;
    onChange(index);
    buttons.current[index]?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      select((safeIndex + 1) % count);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      select((safeIndex - 1 + count) % count);
    } else if (event.key === 'Home') {
      event.preventDefault();
      select(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      select(count - 1);
    }
  };

  return (
    <div className="ckp-tabs" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-${item.id}`}
          aria-selected={index === safeIndex}
          aria-controls={index === safeIndex ? panelIdFor(item.id) : undefined}
          aria-label={item.label}
          tabIndex={index === (safeIndex === -1 ? 0 : safeIndex) ? 0 : -1}
          onClick={() => onChange(index)}
        >
          {item.icon}
          {showLabel ? <span className="ckp-tab-label">{item.label}</span> : null}
        </button>
      ))}
    </div>
  );
}

export default CarnetMediaTabs;
