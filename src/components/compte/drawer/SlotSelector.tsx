'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { SlotId } from './SlotShell';

export interface SlotSelectorItem {
  id: SlotId;
  label: string;
}

/** Les 5 slots du drawer Profil, dans l'ordre du plan. */
export const SLOT_SELECTOR_ITEMS: SlotSelectorItem[] = [
  { id: 'vitrine', label: 'Vitrine' },
  { id: 'kit', label: 'Kit' },
  { id: 'prets', label: 'Prêts' },
  { id: 'souvenirs', label: 'Souvenirs' },
  { id: 'communaute', label: 'Communauté' },
];

const iconProps = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: 'false',
} as const;

const SLOT_ICONS: Record<SlotId, React.ReactNode> = {
  vitrine: (
    <svg {...iconProps}>
      <path d="M4 10v10h16V10M3 10l1.6-5h14.8L21 10M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M9 20v-6h6v6" />
    </svg>
  ),
  kit: (
    <svg {...iconProps}>
      <path d="M9 6.5V5a3 3 0 0 1 6 0v1.5" />
      <path d="M6 10.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8.5Z" />
      <path d="M9.5 14h5v4h-5z" />
    </svg>
  ),
  prets: (
    <svg {...iconProps}>
      <path d="M4 8h13l3 5v5H4V8Z" />
      <path d="M4 13h16M8 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  ),
  souvenirs: (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  ),
  communaute: (
    <svg {...iconProps}>
      <path d="M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM3 19.5c.6-3.3 3-5.3 6-5.3s5.4 2 6 5.3M16.5 11a2.6 2.6 0 1 0 0-5.2M17 14.4c2.2.3 3.6 2 4 5" />
    </svg>
  ),
};

export interface SlotSelectorProps {
  activeSlot: SlotId;
  onSlotChange: (slot: SlotId) => void;
  slots?: SlotSelectorItem[];
}

/**
 * Sélecteur de slot du drawer Profil.
 *
 * Réutilise, sans le réinventer, le sélecteur de la carte principale :
 * la capsule `.ig-tabs` et sa lentille `.ig-th lens`. Seule la géométrie est
 * locale : 5 icônes de 18 px, cible tactile de 44 px, l'actif s'élargit pour
 * afficher son libellé, position bas-gauche au-dessus de la bottom bar.
 */
export function SlotSelector({
  activeSlot,
  onSlotChange,
  slots = SLOT_SELECTOR_ITEMS,
}: SlotSelectorProps) {
  const buttonsRef = useRef<Partial<Record<SlotId, HTMLButtonElement | null>>>({});
  const [lensBox, setLensBox] = useState({ x: 0, w: 44 });

  const measure = useCallback(() => {
    const button = buttonsRef.current[activeSlot];
    if (!button) return;
    const x = button.offsetLeft;
    const w = button.offsetWidth || 44;
    setLensBox((current) => (current.x === x && current.w === w ? current : { x, w }));
  }, [activeSlot]);

  useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    Object.values(buttonsRef.current).forEach((button) => {
      if (button) observer.observe(button);
    });
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      className="ig-tabs lkdv-slot-selector"
      role="tablist"
      aria-label="Slots du profil"
      style={
        {
          '--lens-x': `${lensBox.x}px`,
          '--lens-w': `${lensBox.w}px`,
        } as React.CSSProperties
      }
    >
      <span className="ig-th lens" aria-hidden="true" />
      {slots.map((slot) => {
        const active = slot.id === activeSlot;
        return (
          <button
            key={slot.id}
            ref={(element) => {
              buttonsRef.current[slot.id] = element;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={slot.label}
            data-slot={slot.id}
            onClick={() => {
              if (!active) onSlotChange(slot.id);
            }}
          >
            {SLOT_ICONS[slot.id]}
            {active ? <span className="lkdv-slot-selector-label">{slot.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default SlotSelector;
