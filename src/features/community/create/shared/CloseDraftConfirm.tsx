'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CreateKind } from '../engine/createSchemas';
import './create-shared.css';

const KIND_LABELS: Record<CreateKind, string> = {
  post: 'publication',
  story: 'story',
  carnet: 'carnet',
  sortie: 'sortie',
  kit: 'kit',
  club: 'club',
};

export interface CloseDraftConfirmProps {
  open: boolean;
  kind: CreateKind;
  onKeepEditing: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation de fermeture quand un brouillon non vide existe.
 *
 * Le brouillon reste sur l’appareil : fermer ne le supprime pas. Le dialogue
 * est au-dessus des deux couches de drawer et rend le focus au bouton qui
 * permet de continuer l’édition.
 */
export function CloseDraftConfirm({
  open,
  kind,
  onKeepEditing,
  onConfirm,
}: CloseDraftConfirmProps) {
  const keepRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => keepRef.current?.focus(), 40);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onKeepEditing();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onKeepEditing, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="lkdv-create-confirm-layer">
      <div
        className="lkdv-create-confirm-backdrop"
        aria-hidden="true"
        onClick={onKeepEditing}
      />
      <div
        className="lkdv-create-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lkdv-create-confirm-title"
        aria-describedby="lkdv-create-confirm-text"
      >
        <b id="lkdv-create-confirm-title">Fermer sans publier ?</b>
        <p id="lkdv-create-confirm-text">
          Ton brouillon de {KIND_LABELS[kind]} est conservé sur cet appareil. Tu pourras
          reprendre où tu t’es arrêté.
        </p>
        <div className="lkdv-create-confirm-actions">
          <button ref={keepRef} type="button" onClick={onKeepEditing}>
            Continuer l’édition
          </button>
          <button type="button" className="is-danger" onClick={onConfirm}>
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CloseDraftConfirm;
