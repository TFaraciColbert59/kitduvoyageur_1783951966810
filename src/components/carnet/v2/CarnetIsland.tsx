'use client';

import React, { useEffect, useState } from 'react';

export interface CarnetIslandToast {
  id: string;
  message: string;
  /** Deuxième ligne (maquette `#isl-s`) : lieu, jour, précision. */
  subtitle?: string;
  undo?: () => void;
}

export interface CarnetIslandProps {
  toast: CarnetIslandToast | null;
  onDismiss: () => void;
}

/**
 * Île dynamique pour la fiche carnet v2 :
 * Fond noir, coins arrondis, durée 3.8s, bouton Annuler si callback fourni, aria-live="polite".
 */
export function CarnetIsland({ toast, onDismiss }: CarnetIslandProps) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setAnimating(true);
    const timer = setTimeout(() => {
      onDismiss();
    }, 3800);

    return () => {
      clearTimeout(timer);
    };
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      className="lkdv-carnet-island"
      role="status"
      aria-live="polite"
      data-testid="carnet-island"
    >
      <div className="lkdv-carnet-island-text">
        <b>{toast.message}</b>
        {toast.subtitle ? <span>{toast.subtitle}</span> : null}
      </div>
      {toast.undo ? (
        <button
          type="button"
          className="lkdv-carnet-island-undo"
          onClick={() => {
            toast.undo?.();
            onDismiss();
          }}
          aria-label="Annuler l'action"
        >
          Annuler
        </button>
      ) : null}
    </div>
  );
}
