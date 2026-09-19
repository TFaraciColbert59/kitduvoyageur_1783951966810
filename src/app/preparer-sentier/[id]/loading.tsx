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
      className="min-h-dvh grid place-items-center bg-transparent"
    >
      <div
        role="status"
        aria-label="Préparation de l'activité en cours"
        className="glass-sub-card w-56 rounded-full p-1"
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--lkv-primary)]/10">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-[var(--lkv-primary)]/80 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
