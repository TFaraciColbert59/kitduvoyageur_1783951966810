'use client';

import React from 'react';

export interface CommunitySlotProps {
  lens?: string;
  payload?: unknown;
  [key: string]: unknown;
}

/**
 * Slot Communauté — coquille de la tâche 3. Le contenu réel (Défis, Clubs,
 * Cordée) est livré par les tâches suivantes ; d'ici là on n'affiche qu'un
 * état vide explicite, sans aucune donnée inventée.
 */
export function CommunitySlot({ lens }: CommunitySlotProps) {
  return (
    <div
      className="lkdv-slot-state"
      data-state="empty"
      data-testid="slot-content"
      data-slot="communaute"
      data-lens={lens ?? 'challenges'}
    >
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        ○
      </span>
      <p>Aucun défi en cours.</p>
    </div>
  );
}

export default CommunitySlot;
