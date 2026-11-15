'use client';

import { presentNativeActions, presentNativePrompt, supportsNativeIOSUI } from '@/lib/native/ui';
import * as nativeUI from '@/lib/native/ui';

function hasNativeDialogSupport(): boolean {
  if ('supportsNativeUI' in nativeUI && typeof (nativeUI as Record<string, unknown>).supportsNativeUI === 'function') {
    return ((nativeUI as Record<string, unknown>).supportsNativeUI as () => boolean)();
  }
  return typeof supportsNativeIOSUI === 'function' ? supportsNativeIOSUI() : false;
}

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
  // supported iOS shells and Material 3 on Android, with the previous accessible Radix dialog untouched
  // on web and unupgraded Capacitor installations.
  if (hasNativeDialogSupport()) {
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
  if (!hasNativeDialogSupport()) return queueWebPrompt(options);
  return presentNativePrompt(options).then((value) =>
    value === undefined ? queueWebPrompt(options) : value
  );
}

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
  durationMs?: number;
}

const toastListeners = new Set<(toast: ToastItem) => void>();

export function subscribeToast(listener: (toast: ToastItem) => void): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function emitToast(toast: ToastItem): void {
  for (const listener of toastListeners) {
    try {
      listener(toast);
    } catch {}
  }
}

/**
 * lkvAlert — Affiche une alerte / notification adaptée à la plateforme.
 * Sur natif iOS/Android : alerte système native.
 * Sur Web : ToastHost Liquid Glass dans layout.tsx.
 */
export function lkvAlert(
  message: string,
  options?: { title?: string; tone?: 'info' | 'success' | 'warning' | 'error' }
): void {
  if (hasNativeDialogSupport()) {
    void presentNativeActions({
      title: options?.title || 'Information',
      message,
      actions: [{ id: 'ok', title: 'OK' }],
    });
    return;
  }

  emitToast({
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message,
    title: options?.title,
    tone: options?.tone || 'info',
    durationMs: 4000,
  });
}
