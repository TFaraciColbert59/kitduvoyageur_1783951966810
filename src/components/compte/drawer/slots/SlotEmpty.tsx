'use client';

import React from 'react';

/**
 * État vide d'un slot du drawer Profil.
 *
 * Volontairement minimal : un titre, une phrase, une action. Pas d'icône
 * décorative ni de carte intermédiaire, et le bloc prend toute la hauteur
 * disponible pour ne pas laisser un grand vide sous le contenu.
 */
export function SlotEmpty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="lkdv-slot-empty" role="status">
      <b>{title}</b>
      {hint ? <p>{hint}</p> : null}
      {action}
    </div>
  );
}

export default SlotEmpty;
