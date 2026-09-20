'use client';

import React from 'react';

/**
 * Fond vidéo — TOILE UNIQUE : l'image de fond applicative (marbrure vert
 * forêt) est désormais affichée sur toutes les routes (directive « tous les
 * fonds du site sans exception »). Le composant conserve son API (fixe,
 * zIndex 0) pour ne rien casser.
 */
export function BackgroundVideo() {
  return (
    <div
      className="lkv-app-background z-[var(--z-base)]"
      aria-hidden="true"
    />
  );
}

export default BackgroundVideo;
