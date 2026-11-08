'use client';

import { useCallback, useMemo, useRef } from 'react';

/** Appui long (Peek & Pop) : 460 ms, tolérance de déplacement 10 px. */
export const LONG_PRESS_MS = 460;
const MOVE_TOLERANCE_PX = 10;

type LongPressElement = HTMLElement;

export interface LongPressHandlers {
  onPointerDown: (event: React.PointerEvent<LongPressElement>) => void;
  onPointerMove: (event: React.PointerEvent<LongPressElement>) => void;
  onPointerUp: (event: React.PointerEvent<LongPressElement>) => void;
  onPointerCancel: (event: React.PointerEvent<LongPressElement>) => void;
  onPointerLeave: (event: React.PointerEvent<LongPressElement>) => void;
  onContextMenu: (event: React.MouseEvent<LongPressElement>) => void;
  onClickCapture: (event: React.MouseEvent<LongPressElement>) => void;
}

export interface LongPressOptions {
  onLongPress: (element: LongPressElement) => void;
  delay?: number;
  enabled?: boolean;
}

/**
 * Appui long tactile (et clic droit / menu contextuel au bureau) sur une tuile.
 *
 * - le geste est annulé au moindre déplacement > 10 px, au relâchement, à la
 *   sortie du pointeur ou à `pointercancel` ;
 * - après déclenchement, le clic suivant est neutralisé (`onClickCapture`) :
 *   l'aperçu ne doit pas aussi ouvrir la tuile ;
 * - `prefers-reduced-motion` ne change rien au geste (ce n'est pas une animation).
 */
export function useLongPress({ onLongPress, delay = LONG_PRESS_MS, enabled = true }: LongPressOptions): LongPressHandlers {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const callbackRef = useRef(onLongPress);
  callbackRef.current = onLongPress;

  const cancel = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const fire = useCallback((element: LongPressElement | null) => {
    if (!element) return;
    cancel();
    firedRef.current = true;
    callbackRef.current(element);
    // Laisse passer le `pointerup` du même geste avant de réarmer.
    window.setTimeout(() => {
      firedRef.current = false;
    }, 700);
  }, [cancel]);

  return useMemo<LongPressHandlers>(
    () => ({
      onPointerDown: (event) => {
        if (!enabled || event.button > 0) return;
        cancel();
        startRef.current = { x: event.clientX, y: event.clientY };
        const element = event.currentTarget;
        timerRef.current = window.setTimeout(() => fire(element), delay);
      },
      onPointerMove: (event) => {
        const start = startRef.current;
        if (!start) return;
        const dx = Math.abs(event.clientX - start.x);
        const dy = Math.abs(event.clientY - start.y);
        if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (event) => {
        event.preventDefault();
        fire(event.currentTarget);
      },
      onClickCapture: (event) => {
        if (!firedRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        firedRef.current = false;
      },
    }),
    [cancel, delay, enabled, fire],
  );
}

export default useLongPress;
