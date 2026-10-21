'use client';

import React from 'react';

export interface LoansSlotProps {
  lens?: string;
  payload?: unknown;
  [key: string]: unknown;
}

/**
 * Slot Prêts — coquille de la tâche 3. Le contenu réel (Je prête,
 * J'emprunte, Confiance) est livré par les tâches suivantes ; d'ici là on
 * n'affiche qu'un état vide explicite, sans aucune donnée inventée.
 */
export function LoansSlot({ lens }: LoansSlotProps) {
  return (
    <div
      className="lkdv-slot-state"
      data-state="empty"
      data-testid="slot-content"
      data-slot="prets"
      data-lens={lens ?? 'lender'}
    >
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        ○
      </span>
      <p>Aucun prêt en cours.</p>
    </div>
  );
}

export default LoansSlot;
