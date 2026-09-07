'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
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
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <GlassCard
        tone="neutral"
        className="w-full max-w-md p-6 rounded-[var(--lkv-radius-xl)] border border-white/80 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border border-white/60 shadow-2xs ${
                danger ? 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]' : 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]'
              }`}
            >
              {danger ? <AlertTriangle size={20} /> : <AlertTriangle size={20} />}
            </div>
            <h4 className="text-base font-bold text-[var(--lkv-text-primary)]">{title}</h4>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="w-9 h-9 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-secondary)] hover:bg-white transition-all cursor-pointer shadow-2xs"
          >
            <X size={18} />
          </button>
        </div>

        {message && <p className="text-sm text-[var(--lkv-text-muted)] leading-relaxed">{message}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <GlassCapsuleBtn type="button" variant="default" size="sm" onClick={onCancel}>
            {cancelLabel}
          </GlassCapsuleBtn>
          <GlassCapsuleBtn
            type="button"
            variant={danger ? 'primary' : 'primary'}
            size="sm"
            onClick={onConfirm}
            className={danger ? 'bg-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/90 text-white border-[var(--lkv-danger)]' : ''}
          >
            {confirmLabel}
          </GlassCapsuleBtn>
        </div>
      </GlassCard>
    </div>
  );
}

export default ConfirmDialog;
