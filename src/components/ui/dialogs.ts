'use client';

import toast from 'react-hot-toast';

/**
 * Primitives LKDV pour dialogues utilisateur (Chantier U - U4 & U-D63).
 * Remplace les appels directs à window.alert, window.confirm et window.prompt.
 */

export function lkvAlert(message: string): void {
  toast(message);
}

export function lkvConfirm(message: string): boolean {
  if (typeof window !== 'undefined') {
    return window.confirm(message);
  }
  return true;
}

export function lkvPrompt(message: string, defaultValue?: string): string | null {
  if (typeof window !== 'undefined') {
    return window.prompt(message, defaultValue);
  }
  return null;
}
