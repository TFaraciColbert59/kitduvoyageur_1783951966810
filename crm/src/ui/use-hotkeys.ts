'use client';

import { useEffect } from 'react';

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE.has(target.tagName)) return true;
  return target.isContentEditable;
}

export type HotkeyMap = {
  /** Touche simple, insensible à la casse : `j`, `k`, `m`, `l`, `s`, `a`, `p`, `?`. */
  [key: string]: (() => void) | undefined;
};

/**
 * Raccourcis de § 4 : aucun raccourci ne s'active dans un champ de saisie.
 * `Échap` et `⌘K / Ctrl+K` sont traités séparément pour rester disponibles partout.
 */
export function useHotkeys(map: HotkeyMap, options: { enabled?: boolean; onEscape?: () => void; onCommand?: () => void } = {}) {
  const { enabled = true, onEscape, onCommand } = options;

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onCommand?.();
        return;
      }
      if (isEditable(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      const action = map[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      action();
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [map, enabled, onEscape, onCommand]);
}
