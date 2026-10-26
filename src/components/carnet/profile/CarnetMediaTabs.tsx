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
}

/**
 * Sélecteur 31 px du Compte (`.ig-tabs` + lentille `.ig-th`), ici une rangée de
 * pastilles de pages. Clavier : flèches gauche/droite avec bouclage, `Home`,
 * `End`, roving `tabIndex`, `aria-selected` et `aria-controls` sur l'actif.
 */
export function CarnetMediaTabs({ items, activeIndex, onChange, ariaLabel }: CarnetMediaTabsProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const count = items.length;
  const safeIndex = count > 0 ? (activeIndex < 0 ? -1 : Math.max(0, Math.min(activeIndex, count - 1))) : -1;
  const lensIndex = Math.max(0, safeIndex);

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
    <div
      className="ckp-tabs"
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      style={{ '--n': items.length } as React.CSSProperties}
    >
      <span className="ckp-th" aria-hidden="true" style={{ '--i': lensIndex } as React.CSSProperties} />
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type="button"
          role="tab"
          id={`carnet-page-tab-${item.id}`}
          aria-selected={index === safeIndex}
          aria-controls={index === safeIndex ? `carnet-page-${item.id}` : undefined}
          aria-label={item.label}
          tabIndex={index === (safeIndex === -1 ? 0 : safeIndex) ? 0 : -1}
          onClick={() => onChange(index)}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

export default CarnetMediaTabs;
