'use client';

// Hub live (§4.5) — reveal canonique : fondu + micro-translation (opacity/y),
// durée 0.24 s, ease iOS [0.22, 1, 0.36, 1], stagger min(index × 0.04, 0.3).
// T10 fix — un seul type d'élément rendu en permanence (`motion.div`) : le
// reveal est une animation de motion values, jamais un remount (focus et
// identité DOM d'une rangée déjà à l'écran préservés). `active` pilote le
// déclenchement (seen-set du bus, INSERT uniquement).
// useReducedMotion → aucun offset, aucune animation.
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';

export const ARRIVAL_REVEAL_DURATION = 0.24;
export const ARRIVAL_REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const ARRIVAL_REVEAL_STAGGER = 0.04;
export const ARRIVAL_REVEAL_MAX_DELAY = 0.3;

export interface ArrivalRevealProps {
  children: ReactNode;
  /** Position dans la vague d'arrivées (stagger ≤ 0,3 s). */
  index?: number;
  className?: string;
  /**
   * T10 fix — reveal piloté par événement : `false` = rendu stable sans
   * animation, `true` = joue le reveal (une fois) sur le même élément.
   * Défaut : true (sémantique T9, reveal au montage).
   */
  active?: boolean;
}

/** Délai de stagger : min(index × 0.04, 0.3) ; 0 sous reduced-motion. */
export function arrivalDelay(index: number, reduceMotion: boolean | null): number {
  if (reduceMotion) return 0;
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.min(index * ARRIVAL_REVEAL_STAGGER, ARRIVAL_REVEAL_MAX_DELAY);
}

/**
 * État initial du reveal : offset y 8 au premier cycle uniquement.
 * `hasRevealed` est vrai après le premier cycle → `false`.
 */
export function arrivalInitial(
  hasRevealed: boolean,
  reduceMotion: boolean | null
): false | { opacity: number; y: number } {
  if (reduceMotion || hasRevealed) return false;
  return { opacity: 0, y: 8 };
}

export function ArrivalReveal({ children, index = 0, className, active = true }: ArrivalRevealProps) {
  const reduceMotion = useReducedMotion();
  const shouldReveal = active && !reduceMotion;
  const mountInitial = active ? arrivalInitial(false, reduceMotion) : false;
  const opacity = useMotionValue(mountInitial ? mountInitial.opacity : 1);
  const y = useMotionValue(mountInitial ? mountInitial.y : 0);
  const hasRevealed = useRef(false);

  useEffect(() => {
    if (!shouldReveal || hasRevealed.current) return;
    // Rejoue depuis l'offset canonique : le même élément est déjà monté quand
    // l'arrivée INSERT le rejoint (aucun remount, aucune perte de focus).
    opacity.set(0);
    y.set(8);
    const delay = arrivalDelay(index, reduceMotion);
    const controls = [
      animate(opacity, 1, {
        duration: ARRIVAL_REVEAL_DURATION,
        ease: ARRIVAL_REVEAL_EASE,
        delay,
      }),
      animate(y, 0, {
        duration: ARRIVAL_REVEAL_DURATION,
        ease: ARRIVAL_REVEAL_EASE,
        delay,
      }),
    ];
    let cancelled = false;
    void Promise.all(controls.map((control) => control.finished))
      .then(() => {
        if (!cancelled) hasRevealed.current = true;
      })
      .catch(() => {
        /* animation interrompue (cleanup/StrictMode) : le prochain cycle reprend */
      });
    return () => {
      cancelled = true;
      for (const control of controls) control.stop();
    };
  }, [shouldReveal, index, reduceMotion, opacity, y]);

  return (
    <motion.div data-arrival="" className={className} style={{ opacity, y }}>
      {children}
    </motion.div>
  );
}

export default ArrivalReveal;
