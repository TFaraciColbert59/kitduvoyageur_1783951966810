'use client';

import toast from 'react-hot-toast';
import { presentNativeActions, presentNativePrompt, supportsNativeIOSUI } from '@/lib/native/ui';

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

function queueWebConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pending = { ...options, resolve };
    emit();
  });
}

export function lkvConfirm(messageOrOptions: string | ConfirmOptions): Promise<boolean> {
  const options: ConfirmOptions = typeof messageOrOptions === 'string'
    ? { message: messageOrOptions }
    : messageOrOptions;

  // One implementation for all Next.js routes: real SwiftUI confirmation on
  // supported iOS shells, with the previous accessible Radix dialog untouched
  // on Android, web, /compas, and unupgraded Capacitor installations.
  if (supportsNativeIOSUI()) {
    return presentNativeActions({
      title: options.title || 'Confirmation',
      message: options.message,
      actions: [
        { id: 'cancel', title: options.cancelLabel || 'Annuler' },
        {
          id: 'confirm',
          title: options.confirmLabel || 'Confirmer',
          destructive: options.variant === 'destructive',
        },
      ],
    }).then((selection) => {
      if (selection !== undefined) return selection === 'confirm';
      return queueWebConfirm(options);
    });
  }

  return queueWebConfirm(options);
}

export interface PromptOptions {
  title: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
}

export type PromptRequest = PromptOptions & {
  resolve: (value: string | null) => void;
};

let pendingPrompt: PromptRequest | null = null;
const promptListeners = new Set<(request: PromptRequest | null) => void>();

function emitPrompt(): void {
  for (const listener of promptListeners) listener(pendingPrompt);
}

export function subscribePrompt(
  listener: (request: PromptRequest | null) => void
): () => void {
  promptListeners.add(listener);
  listener(pendingPrompt);
  return () => {
    promptListeners.delete(listener);
  };
}

export function resolvePrompt(value: string | null): void {
  const current = pendingPrompt;
  pendingPrompt = null;
  emitPrompt();
  current?.resolve(value);
}

function queueWebPrompt(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    pendingPrompt = { ...options, resolve };
    emitPrompt();
  });
}

export function lkvPromptAsync(options: PromptOptions): Promise<string | null> {
  if (!supportsNativeIOSUI()) return queueWebPrompt(options);
  return presentNativePrompt(options).then((value) =>
    value === undefined ? queueWebPrompt(options) : value
  );
}

export function lkvAlert(message: string): void {
  toast(message);
}
