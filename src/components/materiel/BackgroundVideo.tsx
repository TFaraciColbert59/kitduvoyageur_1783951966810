'use client';

import React from 'react';

/**
 * Fond vidéo — TOILE UNIQUE : remplacé par un fond uni plat légèrement teinté
 * de vert doux (directive « tous les fonds du site sans exception »).
 * Le composant conserve son API (fixe, zIndex 0) pour ne rien casser.
 */
export function BackgroundVideo() {
  return (
    <div
      className="fixed top-0 left-0 overflow-hidden pointer-events-none"
      style={{ width: '100%', height: '100dvh', zIndex: 0, background: '#EEF3EC' }}
      aria-hidden="true"
    />
  );
}

export default BackgroundVideo;
