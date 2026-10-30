'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearDraft, draftKey, hasContent, readDraft, writeDraft } from './draft';

const SAVE_DELAY_MS = 400;

export interface DraftedForm<T> {
  values: T;
  patch: (change: Partial<T>) => void;
  /** Efface le brouillon et revient aux valeurs initiales (après un envoi réussi). */
  clear: () => void;
  /** Vrai si une saisie précédente a été restaurée au montage. */
  restored: boolean;
}

/**
 * État d'un formulaire avec brouillon local. Les valeurs doivent être
 * sérialisables en JSON (texte, nombres, booléens, listes de texte).
 */
export function useDraftedForm<T extends Record<string, unknown>>(
  kind: string,
  userId: string | null | undefined,
  initial: T,
): DraftedForm<T> {
  const key = draftKey(kind, userId);
  const initialRef = useRef(initial);
  const [values, setValues] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    const saved = readDraft<Partial<T>>(key);
    if (saved) {
      setValues((current) => ({ ...current, ...saved }));
      setRestored(true);
    }
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => {
      if (hasContent(values)) writeDraft(key, values);
      else clearDraft(key);
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key, values]);

  const patch = useCallback((change: Partial<T>) => setValues((current) => ({ ...current, ...change })), []);
  const clear = useCallback(() => {
    clearDraft(key);
    setValues(initialRef.current);
    setRestored(false);
  }, [key]);

  return { values, patch, clear, restored };
}
