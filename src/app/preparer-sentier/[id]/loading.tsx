import React from 'react';

/**
 * Écran de préparation streamé pendant que la route serveur prépare
 * l'activité (génération + dressage, jusqu'à ~20 s). Sans lui, la
 * navigation reste blanche pendant tout le travail serveur.
 * Barre seule, sans texte (préférence produit) — accessible via aria-label.
 */
export default function PreparerSentierLoading() {
  return (
    <div
      data-testid="preparer-sentier-loading"
      className="grid min-h-dvh place-items-center bg-transparent"
    >
      <div
        role="status"
        aria-label="Préparation de l'activité en cours"
        className="w-56 rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] p-1 shadow-elevation-1"
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--lkv-primary)]/10">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-[color:var(--lkv-primary)]/80 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
