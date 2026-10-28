'use client';

import React from 'react';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';
import type { SlotId } from './SlotShell';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

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
  vitrine: <LKDVIcon name="calques" size={18} aria-hidden="true" />,
  kit: <LKDVIcon name="boutique" size={18} aria-hidden="true" />,
  prets: <LKDVIcon name="itineraire" size={18} aria-hidden="true" />,
  souvenirs: <LKDVIcon name="signet" size={18} aria-hidden="true" />,
  communaute: <LKDVIcon name="communaute" size={18} aria-hidden="true" />,
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
 * Le markup et l'interaction sont ceux de la capsule principale partagée
 * (`CapsuleTabs`, 48 px, lentille `.sel-lens`, 420 ms) : ce composant ne porte
 * plus que les libellés, les glyphes et les identifiants du drawer. Le DOM
 * produit reste identique (`.segc.lg-tabs.lens-on.lkdv-slot-selector`,
 * `role="tablist"`, `aria-label="Slots du profil"`, `data-slot`, ids
 * `lkdv-slot-tab-*` / `lkdv-slot-panel-*`).
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

  const items = slots.map((slot) => ({
    id: slot.id,
    label: slot.label,
    icon: SLOT_GLYPHS[slot.id],
  }));

  return (
    <CapsuleTabs
      items={items}
      activeIndex={activeIndex}
      onIndexChange={(index) => {
        const next = slots[index];
        if (next && next.id !== activeSlot) onSlotChange(next.id);
      }}
      ariaLabel="Slots du profil"
      className="lkdv-slot-selector"
      idFor={(id) => slotTabId(id as SlotId)}
      panelIdFor={() => slotPanelId(activeSlot)}
      dataSlot
    />
  );
}

export default SlotSelector;
