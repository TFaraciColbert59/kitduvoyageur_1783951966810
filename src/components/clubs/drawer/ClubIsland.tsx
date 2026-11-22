'use client';

import React, { useEffect } from 'react';

export interface ClubIslandToast {
  id: string;
  message: string;
  subtitle?: string;
  undo?: () => void;
}

export interface ClubIslandProps {
  toast: ClubIslandToast | null;
  onDismiss: () => void;
}

export const MAX_CLUB_UNDO = 40;

/**
 * Île dynamique Club v2 :
 * Miroir exact de `CarnetIsland`, 3.8s auto-dismiss, role="status", aria-live="polite",
 * avec bouton Annuler si un callback undo est fourni.
 */
export function ClubIsland({ toast, onDismiss }: ClubIslandProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 3800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      className="lkdv-carnet-island lkdv-club-island"
      role="status"
      aria-live="polite"
      data-testid="club-island"
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

export default ClubIsland;
