'use client';

import React from 'react';

/**
 * Badge d'état de la carte du carnet : `Tout` au résumé, `J{n}` sur un jour.
 * Reprend la pastille `.mbadge` de la maquette (verre, encre tint).
 */
export function CarnetMapBadge({ activeDay }: { activeDay: number }) {
  return (
    <div className="lkdv-map-badge" aria-hidden="true">
      {activeDay > 0 ? `J${activeDay}` : 'Tout'}
    </div>
  );
}
