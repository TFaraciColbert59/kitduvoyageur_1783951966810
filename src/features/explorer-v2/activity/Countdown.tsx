'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { haptic } from '../state/haptics';

/**
 * Compte à rebours de départ d'activité : 3 · 2 · 1 (09_DESIGN §5).
 * Chaque chiffre : ressort 1,45 → 1 + fondu, 1 s, haptique `rigid`.
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
    <motion.div
      className="xp-countdown"
      role="status"
      aria-live="assertive"
      aria-label={`Départ dans ${remaining}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ zIndex: 60 }}
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={remaining}
          className="xp-countdown-digit"
          initial={{ opacity: 0, scale: 1.48 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.72 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28, mass: 0.7 }}
        >
          {remaining > 0 ? remaining : 'GO'}
        </motion.span>
      </AnimatePresence>
      {onCancel ? (
        <motion.button
          type="button"
          className="xp-countdown-cancel xp20-tactile"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32, delay: 0.08 }}
          onClick={onCancel}
          aria-label="Annuler le départ"
        >
          Annuler
        </motion.button>
      ) : null}
    </motion.div>
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
