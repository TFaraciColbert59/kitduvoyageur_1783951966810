'use client';

import React from 'react';

export interface CarnetSkeletonProps {
  /** Lignes de 48 px après le bloc héros (5 par défaut, état de chargement). */
  rows?: number;
  /** Bloc héros de 40 px en tête. */
  hero?: boolean;
}

/**
 * Chargement : un bloc héros de 40 px puis des lignes de 48 px, shimmer de
 * 1,4 s. Aucun texte — l'état est porté par `role="status"` et son nom
 * accessible, jamais par une phrase à l'écran.
 */
export function CarnetSkeleton({ rows = 5, hero = true }: CarnetSkeletonProps) {
  return (
    <div className="ckp-load" role="status" aria-label="Chargement">
      {hero ? <span className="ckp-load-bar ckp-load-bar--hero" aria-hidden="true" /> : null}
      {Array.from({ length: rows }, (_, index) => (
        <span className="ckp-load-bar ckp-load-bar--row" key={index} aria-hidden="true" />
      ))}
    </div>
  );
}

export interface CarnetEmptyProps {
  /** Glyphe de 32 px, peint à 30 %. */
  icon?: React.ReactNode;
  label?: string;
}

/**
 * État vide : un glyphe de 32 px à 30 % et un tiret. Aucune phrase, aucun
 * encadré — l'absence de donnée est un fait, pas un discours.
 */
export function CarnetEmpty({ icon, label }: CarnetEmptyProps) {
  return (
    <div className="ckp-empty-state" role="status" aria-label={label}>
      {icon ? (
        <span className="ckp-empty-glyph" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="ckp-empty-dash">—</span>
    </div>
  );
}

export default CarnetSkeleton;
