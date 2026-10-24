'use client';

import React from 'react';

/**
 * Contenu d'un état vide. La racine du slot porte déjà `lkdv-slot-state` et
 * `data-state="empty"` : on ne duplique pas la boîte.
 */
export function EmptyState({ label }: { label: string }) {
  return (
    <>
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        ○
      </span>
      <p>{label}</p>
    </>
  );
}

export default EmptyState;
