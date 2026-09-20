'use client';

import toast from 'react-hot-toast';

/**
 * Primitives LKDV pour dialogues utilisateur (Chantier U - U4 & U-D63).
 *
 * Phase 2 (Lot 3) — `lkvConfirm` n'utilise PLUS window.confirm : la demande est
 * routée vers l'hôte global `ConfirmHost` (ConfirmDialog Radix accessible,
 * focus trap, Escape/overlay). L'API reste une promesse :
 *
 *   if (!(await lkvConfirm('Supprimer ?'))) return;
 */

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

export type ConfirmRequest = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

let pending: ConfirmRequest | null = null;
const listeners = new Set<(request: ConfirmRequest | null) => void>();

function emit(): void {
  for (const listener of listeners) listener(pending);
}

export function subscribeConfirm(
  listener: (request: ConfirmRequest | null) => void
): () => void {
  listeners.add(listener);
  listener(pending);
  return () => {
    listeners.delete(listener);
  };
}

export function resolveConfirm(ok: boolean): void {
  const current = pending;
  pending = null;
  emit();
  current?.resolve(ok);
}

export function lkvConfirm(messageOrOptions: string | ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pending = {
      ...(typeof messageOrOptions === 'string'
        ? { message: messageOrOptions }
        : messageOrOptions),
      resolve,
    };
    emit();
  });
}

export function lkvAlert(message: string): void {
  toast(message);
}

/** Exception documentée : la saisie de texte n'a pas encore d'hôte canonique. */
export function lkvPrompt(message: string, defaultValue?: string): string | null {
  if (typeof window !== 'undefined') {
    return window.prompt(message, defaultValue);
  }
  return null;
}
