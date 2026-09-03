'use client';

import { useRef, useCallback, useEffect } from 'react';
import { isWithinTapWindow, DEFAULT_DOUBLE_TAP_WINDOW_MS } from './gestureMath';

/**
 * Double-tap unifié — remplace le `lastTapRef` inline de MessageBubble.tsx
 * (fenêtre 300ms) et sert de base au double-tap-to-like du feed.
 *
 * La détection se fait sur `click` (comme l'implémentation historique) :
 * souris + tactile, et compatible avec les `stopPropagation` des enfants.
 * Le callback ne se déclenche qu'au second tap dans la fenêtre ; un tap
 * isolé reste sans effet (comportement iMessage/Instagram).
 */
export interface UseDoubleTapOptions {
  /** Fenêtre max entre les deux clicks en ms (défaut 300). */
  windowMs?: number;
  /**
   * Callback du tap isolé (optionnel) — déclenché après `windowMs` si aucun
   * second tap n'est arrivé (ex. : ouvrir une lightbox sans casser le
   * double-tap-like). Sans ce callback, le tap isolé reste sans effet.
   */
  onSingleTap?: () => void;
}

export function useDoubleTap(
  onDoubleTap: () => void,
  options: UseDoubleTapOptions = {}
) {
  const { windowMs = DEFAULT_DOUBLE_TAP_WINDOW_MS, onSingleTap } = options;
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs de callbacks : la fenêtre de tap lit toujours la version à jour sans
  // re-créer le handler (ni casser un double-tap en cours à chaque render).
  const cbRef = useRef(onDoubleTap);
  cbRef.current = onDoubleTap;
  const singleCbRef = useRef(onSingleTap);
  singleCbRef.current = onSingleTap;

  useEffect(() => {
    return () => {
      lastTapRef.current = 0;
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  const onClick = useCallback(
    (e?: React.MouseEvent) => {
      const now = Date.now();
      if (isWithinTapWindow(lastTapRef.current, now, windowMs)) {
        lastTapRef.current = 0;
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        cbRef.current();
      } else {
        lastTapRef.current = now;
        if (singleCbRef.current) {
          if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = setTimeout(() => {
            singleTapTimerRef.current = null;
            if (isWithinTapWindow(lastTapRef.current, Date.now(), windowMs)) return;
            lastTapRef.current = 0;
            singleCbRef.current?.();
          }, windowMs);
        }
      }
    },
    [windowMs]
  );

  return { onClick };
}
