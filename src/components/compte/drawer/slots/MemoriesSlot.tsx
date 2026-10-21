'use client';

import React from 'react';

export interface MemoriesSlotProps {
  lens?: string;
  payload?: unknown;
  [key: string]: unknown;
}

/**
 * Slot Souvenirs — coquille de la tâche 3. Le contenu réel (Timeline,
 * Passeport, Souvenirs À la une) est livré par les tâches suivantes ; d'ici là
 * on n'affiche qu'un état vide explicite, sans aucune donnée inventée.
 */
export function MemoriesSlot({ lens }: MemoriesSlotProps) {
  return (
    <div
      className="lkdv-slot-state"
      data-state="empty"
      data-testid="slot-content"
      data-slot="souvenirs"
      data-lens={lens ?? 'timeline'}
    >
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        ○
      </span>
      <p>Aucune sortie enregistrée.</p>
    </div>
  );
}

export default MemoriesSlot;
