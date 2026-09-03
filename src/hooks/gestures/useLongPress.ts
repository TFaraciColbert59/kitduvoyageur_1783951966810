'use client';

import { useRef, useCallback, useEffect } from 'react';
import {
  isMoveBeyondTolerance,
  DEFAULT_LONG_PRESS_MS,
  DEFAULT_MOVE_TOLERANCE_PX,
} from './gestureMath';

/**
 * Long-press unifié — remplace les deux implémentations inline à timings
 * identiques mais code séparé (MessageBubble.tsx et ConversationRow.tsx,
 * tous deux setTimeout 450ms + annulation au déplacement du doigt).
 *
 * L'annulation au touchmove (>tolérance) est essentielle : sans elle, faire
 * défiler une liste en posant le doigt sur un élément déclenchait le menu
 * (cf. audit 1.4 de la messagerie).
 */
export interface UseLongPressOptions {
  /** Durée d'appui en ms (défaut 450, timing historique des deux composants). */
  duration?: number;
  /** Déplacement max du doigt en px avant annulation (défaut 8). */
  moveTolerance?: number;
}

export function useLongPress(
  onLongPress: () => void,
  options: UseLongPressOptions = {}
) {
  const { duration = DEFAULT_LONG_PRESS_MS, moveTolerance = DEFAULT_MOVE_TOLERANCE_PX } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const cbRef = useRef(onLongPress);
  cbRef.current = onLongPress;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        cbRef.current();
      }, duration);
    },
    [duration, clearTimer]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!timerRef.current || !startRef.current) return;
      const dx = e.touches[0].clientX - startRef.current.x;
      const dy = e.touches[0].clientY - startRef.current.y;
      if (isMoveBeyondTolerance(dx, dy, moveTolerance)) {
        clearTimer();
      }
    },
    [moveTolerance, clearTimer]
  );

  const onTouchEnd = useCallback(() => {
    clearTimer();
    startRef.current = null;
  }, [clearTimer]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
