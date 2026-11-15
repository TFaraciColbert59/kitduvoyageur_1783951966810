'use client';

import React from 'react';

/**
 * État « lecture indisponible » d'un slot du drawer Profil.
 *
 * Il ne remplace jamais un état vide : le slot doit l'afficher dès qu'un flag
 * `*Unavailable` du bootstrap est vrai, pour ne pas laisser croire à une
 * collection réellement vide.
 */
export function SlotUnavailable({
  label,
  slot,
  lens,
  testId = 'slot-content',
}: {
  label: string;
  slot?: string;
  lens?: string;
  testId?: string;
}) {
  return (
    <div
      className="lkdv-slot-state"
      data-state="error"
      {...(testId ? { 'data-testid': testId } : {})}
      {...(slot ? { 'data-slot': slot } : {})}
      {...(lens ? { 'data-lens': lens } : {})}
      role="status"
    >
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        ⚠
      </span>
      <p>{label}</p>
    </div>
  );
}

export default SlotUnavailable;
