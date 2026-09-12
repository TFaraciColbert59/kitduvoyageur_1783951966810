'use client';

// Hub live (§4.5) — reveal canonique : fondu + micro-translation (opacity/y),
// durée 0.24 s, ease iOS [0.22, 1, 0.36, 1], stagger min(index × 0.04, 0.3).
// Un seul cycle : `initial` retombe à false dès le premier rendu client passé.
// useReducedMotion → aucun offset, aucune transition.
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const ARRIVAL_REVEAL_DURATION = 0.24;
export const ARRIVAL_REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const ARRIVAL_REVEAL_STAGGER = 0.04;
export const ARRIVAL_REVEAL_MAX_DELAY = 0.3;

export interface ArrivalRevealProps {
  children: ReactNode;
  /** Position dans la vague d'arrivées (stagger ≤ 0,3 s). */
  index?: number;
  className?: string;
}

/** Délai de stagger : min(index × 0.04, 0.3) ; 0 sous reduced-motion. */
export function arrivalDelay(index: number, reduceMotion: boolean | null): number {
  if (reduceMotion) return 0;
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.min(index * ARRIVAL_REVEAL_STAGGER, ARRIVAL_REVEAL_MAX_DELAY);
}

/**
 * État initial du reveal : offset y 8 au premier cycle uniquement.
 * `hasRevealed` est vrai après le premier cycle → `initial=false`.
 */
export function arrivalInitial(
  hasRevealed: boolean,
  reduceMotion: boolean | null
): false | { opacity: number; y: number } {
  if (reduceMotion || hasRevealed) return false;
  return { opacity: 0, y: 8 };
}

export function ArrivalReveal({ children, index = 0, className }: ArrivalRevealProps) {
  const reduceMotion = useReducedMotion();
  const hasRevealed = useRef(false);

  useEffect(() => {
    hasRevealed.current = true;
  }, []);

  return (
    <motion.div
      data-arrival=""
      className={className}
      initial={arrivalInitial(hasRevealed.current, reduceMotion)}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : ARRIVAL_REVEAL_DURATION,
        ease: ARRIVAL_REVEAL_EASE,
        delay: arrivalDelay(index, reduceMotion),
      }}
    >
      {children}
    </motion.div>
  );
}

export default ArrivalReveal;
