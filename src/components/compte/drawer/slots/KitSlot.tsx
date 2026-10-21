'use client';

import React from 'react';

export interface KitSlotProps {
  lens?: string;
  payload?: unknown;
  [key: string]: unknown;
}

/**
 * Slot Kit — coquille de la tâche 3. Le contenu réel (Kits, Inventaire) est
 * livré par les tâches suivantes ; d'ici là on n'affiche qu'un état vide
 * explicite, sans aucune donnée inventée.
 */
export function KitSlot({ lens }: KitSlotProps) {
  return (
    <div
      className="lkdv-slot-state"
      data-state="empty"
      data-testid="slot-content"
      data-slot="kit"
      data-lens={lens ?? 'kits'}
    >
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        ○
      </span>
      <p>Aucun kit enregistré.</p>
    </div>
  );
}

export default KitSlot;
