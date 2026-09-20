'use client';

import React from 'react';
import { ConfirmDialog as CanonicalConfirmDialog } from '@/components/ui';

export interface ConfirmDialogProps {
  /** Titre de la boîte de confirmation. */
  title: string;
  /** Message d'explication (optionnel). */
  message?: string;
  /** Libellé du bouton de confirmation (défaut : « Confirmer »). */
  confirmLabel?: string;
  /** Libellé du bouton d'annulation (défaut : « Annuler »). */
  cancelLabel?: string;
  /** Danger => style danger (suppression). */
  danger?: boolean;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Y3.5 — Confirmation accessible du module voyages.
 * Délègue au contrat canonique `@/components/ui/ConfirmDialog` (API conservée
 * pour les appelants existants) : focus trap, Escape, z-index tokenisé.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  open,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <CanonicalConfirmDialog
      open={open}
      title={title}
      description={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      variant={danger ? 'destructive' : 'default'}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export default ConfirmDialog;
