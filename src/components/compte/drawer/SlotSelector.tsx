'use client';

import React, { useCallback, type KeyboardEvent } from 'react';
import { ArrowLeftRight, Bookmark, LayoutGrid, ShoppingBag, Users } from 'lucide-react';
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

const SLOT_GLYPHS: Record<SlotId, React.ReactNode> = {
  vitrine: <LayoutGrid size={18} strokeWidth={1.8} aria-hidden="true" />,
  kit: <ShoppingBag size={18} strokeWidth={1.8} aria-hidden="true" />,
  prets: <ArrowLeftRight size={18} strokeWidth={1.8} aria-hidden="true" />,
  souvenirs: <Bookmark size={18} strokeWidth={1.8} aria-hidden="true" />,
  communaute: <Users size={18} strokeWidth={1.8} aria-hidden="true" />,
};

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
 * Navigation des 5 slots du drawer Profil.
 *
 * Reprend **à l'identique** la capsule des sections du drawer Compte
 * (`.segc.lg-tabs.lens-on`) : même hauteur, même rayon, même lentille
 * `.sel-lens` qui glisse d'une cellule à l'autre, mêmes icônes seules.
 */
export function SlotSelector({
  activeSlot,
  onSlotChange,
  slots = SLOT_SELECTOR_ITEMS,
}: SlotSelectorProps) {
  const activeIndex = Math.max(
    0,
    slots.findIndex((slot) => slot.id === activeSlot)
  );

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
      className="segc lg-tabs lens-on lkdv-slot-selector"
      role="tablist"
      aria-label="Slots du profil"
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      style={{ '--n': slots.length } as React.CSSProperties}
    >
      <span
        className="sel-lens"
        aria-hidden="true"
        style={{ '--i': activeIndex } as React.CSSProperties}
      />
      {slots.map((slot) => {
        const active = slot.id === activeSlot;
        return (
          <button
            key={slot.id}
            id={slotTabId(slot.id)}
            type="button"
            role="tab"
            className={active ? 'active' : ''}
            aria-selected={active}
            aria-controls={active ? slotPanelId(slot.id) : undefined}
            aria-label={slot.label}
            title={slot.label}
            data-slot={slot.id}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              if (!active) onSlotChange(slot.id);
            }}
          >
            <span className="ic s">{SLOT_GLYPHS[slot.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SlotSelector;
