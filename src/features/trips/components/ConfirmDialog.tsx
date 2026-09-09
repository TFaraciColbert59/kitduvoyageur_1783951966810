'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';

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
 * Y3.5 — Modale de confirmation accessible, remplaçant `window.confirm`.
 * Règle Y-D80 n°5 : aucun dialogue natif (alert/confirm/prompt) dans le module.
 * Radix Dialog (GlassModal) : focus trap, Escape, scroll-lock.
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
    <GlassModal open={open} onOpenChange={(v) => { if (!v) onCancel(); }} title={title} hideTitle>
      <div className="space-y-4 pb-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center border border-white/60 shadow-2xs shrink-0 ${
              danger ? 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]' : 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]'
            }`}
          >
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <h4 className="text-base font-bold text-[var(--lkv-text-primary)]">{title}</h4>
        </div>

        {message && <p className="text-sm text-[var(--lkv-text-secondary)] leading-relaxed">{message}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <GlassCapsuleBtn type="button" variant="default" size="sm" onClick={onCancel}>
            {cancelLabel}
          </GlassCapsuleBtn>
          <GlassCapsuleBtn
            type="button"
            variant="primary"
            size="sm"
            onClick={onConfirm}
            className={danger ? 'bg-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/90 text-white border-[var(--lkv-danger)]' : ''}
          >
            {confirmLabel}
          </GlassCapsuleBtn>
        </div>
      </div>
    </GlassModal>
  );
}

export default ConfirmDialog;
