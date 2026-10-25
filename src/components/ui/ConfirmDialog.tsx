'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export type ConfirmDialogVariant = 'default' | 'destructive';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmDialog — confirmation critique/destructive canonique (Lot 3).
 * Remplace window.confirm et les overlays maison : focus trap Radix,
 * Escape/overlay = annulation, aria-labelledby/describedby, z-index token.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[var(--z-modal)] bg-[color:var(--lkv-overlay-scrim)] backdrop-blur-[var(--blur-sm)]"
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[var(--z-modal)] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2',
            'rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)]',
            'p-[var(--space-5)] shadow-[var(--elevation-4)] focus:outline-none'
          )}
        >
          <Dialog.Title className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="mt-[var(--space-2)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-[var(--space-5)] flex justify-end gap-[var(--space-2)]">
            <Button variant="ghost" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === 'destructive' ? 'destructive' : 'primary'}
              onClick={onConfirm}
              loading={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ConfirmDialog;
