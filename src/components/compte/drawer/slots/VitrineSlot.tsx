'use client';

import React from 'react';

export interface VitrineSlotProps {
  lens?: string;
  payload?: unknown;
  [key: string]: unknown;
}

/**
 * Slot Vitrine — coquille de la tâche 3. Le contenu réel (Stats,
 * Republication, Trophées) est livré par les tâches suivantes ; d'ici là on
 * n'affiche qu'un état vide explicite, sans aucune donnée inventée.
 */
export function VitrineSlot({ lens }: VitrineSlotProps) {
  return (
    <div
      className="lkdv-slot-state"
      data-state="empty"
      data-testid="slot-content"
      data-slot="vitrine"
      data-lens={lens ?? 'stats'}
    >
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        ○
      </span>
      <p>Aucune statistique à afficher pour le moment.</p>
    </div>
  );
}

export default VitrineSlot;
