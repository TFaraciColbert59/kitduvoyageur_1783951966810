'use client';

import React, {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { SLOT_ICONS } from './slotIcons';
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

/** Id du panneau de contenu contrôlé par l'onglet d'un slot. */
export const slotPanelId = (slot: SlotId) => `lkdv-slot-panel-${slot}`;
/** Id de l'onglet d'un slot (cible du roving tabindex). */
export const slotTabId = (slot: SlotId) => `lkdv-slot-tab-${slot}`;

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
 *
 * Accessibilité : `tablist` / `tab` avec `aria-controls` vers le panneau du
 * slot, roving tabindex (un seul onglet dans l'ordre de tabulation) et
 * flèches ←/→ (+ Home/End) sur le tablist.
 */
export function SlotSelector({
  activeSlot,
  onSlotChange,
  slots = SLOT_SELECTOR_ITEMS,
}: SlotSelectorProps) {
  const buttonsRef = useRef<Partial<Record<SlotId, HTMLButtonElement | null>>>({});
  const [lensBox, setLensBox] = useState({ x: 0, w: 44 });

  const activeIndex = Math.max(
    0,
    slots.findIndex((slot) => slot.id === activeSlot)
  );

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

  const focusSlotTab = useCallback((slot: SlotId) => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      document.getElementById(slotTabId(slot))?.focus();
    });
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextIndex = -1;
    if (event.key === 'ArrowRight') nextIndex = (activeIndex + 1) % slots.length;
    else if (event.key === 'ArrowLeft') nextIndex = (activeIndex - 1 + slots.length) % slots.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = slots.length - 1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextSlot = slots[nextIndex];
    if (!nextSlot) return;
    if (nextSlot.id !== activeSlot) onSlotChange(nextSlot.id);
    focusSlotTab(nextSlot.id);
  };

  return (
    <div
      className="ig-tabs lkdv-slot-selector"
      role="tablist"
      aria-label="Slots du profil"
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
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
            id={slotTabId(slot.id)}
            type="button"
            role="tab"
            aria-selected={active}
            /* Seul le panneau du slot actif est monté par SlotShell : les
               onglets inactifs ne doivent pas porter d'IDREF orphelin. */
            aria-controls={active ? slotPanelId(slot.id) : undefined}
            aria-label={slot.label}
            data-slot={slot.id}
            tabIndex={active ? 0 : -1}
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
