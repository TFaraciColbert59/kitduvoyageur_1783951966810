'use client';

import React from 'react';

/**
 * Fond LKDV — TOILE UNIQUE : un fond uni plat, sans photo ni vidéo,
 * légèrement teinté d'un vert doux (directive « tous les fonds du site »).
 * Le composant conserve son API (z-index 0, fixe) pour ne rien casser.
 */
export function CompteBackground() {
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none select-none"
      style={{
        zIndex: 0,
        width: '100vw',
        height: '100dvh',
        background: '#EEF3EC',
      }}
      aria-hidden="true"
    />
  );
}

export default CompteBackground;
