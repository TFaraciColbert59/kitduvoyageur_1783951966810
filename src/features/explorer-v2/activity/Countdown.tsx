'use client';

import React, { useEffect, useRef, useState } from 'react';
import { haptic } from '../state/haptics';

/**
 * Compte à rebours de départ d'activité : 3 · 2 · 1 (09_DESIGN §5).
 * Chaque chiffre : échelle 1,4 → 1 + fondu, 1 s, haptique `rigid`.
 */
export function Countdown({
  seconds = 3,
  onDone,
  onCancel,
}: {
  seconds?: number;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const done = useRef(false);

  // L’intervalle ne fait que décrémenter : aucun effet de bord dans un updater.
  useEffect(() => {
    haptic('countdown');
    const timer = window.setInterval(() => {
      setRemaining((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // La fin est un effet séparé, déclenché une seule fois hors du rendu.
  useEffect(() => {
    if (remaining === 0) {
      if (done.current) return;
      done.current = true;
      onDone();
      return;
    }
    if (remaining < seconds) haptic('countdown');
  }, [remaining, seconds, onDone]);

  return (
    <div className="xp-countdown" role="status" aria-live="assertive" aria-label={`Départ dans ${remaining}`}>
      <span key={remaining} className="xp-countdown-digit">
        {remaining > 0 ? remaining : 'GO'}
      </span>
      {onCancel ? (
        <button type="button" className="xp-countdown-cancel" onClick={onCancel} aria-label="Annuler le départ">
          Annuler
        </button>
      ) : null}
    </div>
  );
}

/** Appui long (par défaut 600 ms) sur la carte : ouvre le départ d'activité. */
export function useLongPress(onLongPress: () => void, durationMs = 600) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };

  return {
    onPointerDown: (event: React.PointerEvent) => {
      clear();
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        onLongPress();
        haptic('activity-start');
      }, durationMs);
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (!origin.current) return;
      // Un geste de carte (déplacement > 8 px) annule l'appui long.
      if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}
