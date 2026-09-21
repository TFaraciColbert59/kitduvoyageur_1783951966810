'use client';

import React from 'react';

/**
 * Fond LKDV — TOILE UNIQUE : l'image de fond applicative (marbrure vert forêt)
 * est désormais affichée sur toutes les routes (directive « tous les fonds du
 * site sont celui-ci »). Le composant conserve son API (z-index 0, fixe) pour
 * ne rien casser ; il superpose la même toile que `.lkv-app-background`.
 */
export function CompteBackground() {
  return (
    <div
      className="lkv-app-background z-[var(--z-base)]"
      aria-hidden="true"
    />
  );
}

export default CompteBackground;
