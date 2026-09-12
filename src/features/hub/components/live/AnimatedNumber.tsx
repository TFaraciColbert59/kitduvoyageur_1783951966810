'use client';

// Hub live (§4.5) — compteur animé : useMotionValue + animate(), chiffres
// tabulaires, aucune variation de largeur (zéro reflow). La valeur affichée
// est mise à jour via textContent (pas de re-render par frame).
// useReducedMotion → valeur statique immédiate.
import { useEffect, useRef } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'framer-motion';

export const ANIMATED_NUMBER_DURATION = 0.6;
export const ANIMATED_NUMBER_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface AnimatedNumberProps {
  value: number;
  /** Nombre de décimales affichées (0–3). */
  decimals?: number;
  className?: string;
}

/** Formatage déterministe (jamais de NaN affiché). */
export function formatAnimatedNumber(value: number, decimals = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  const digits = Math.max(0, Math.min(3, Math.floor(decimals)));
  return safe.toFixed(digits);
}

export function AnimatedNumber({ value, decimals = 0, className = '' }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(Number.isFinite(value) ? value : 0);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const apply = (latest: number) => {
      if (spanRef.current) spanRef.current.textContent = formatAnimatedNumber(latest, decimals);
    };

    if (reduceMotion) {
      motionValue.set(target);
      apply(target);
      return;
    }

    const controls = animate(motionValue, target, {
      duration: ANIMATED_NUMBER_DURATION,
      ease: ANIMATED_NUMBER_EASE,
      onUpdate: apply,
    });
    return () => controls.stop();
  }, [value, decimals, reduceMotion, motionValue]);

  return (
    <span ref={spanRef} className={`tabular-nums ${className}`.trim()}>
      {formatAnimatedNumber(value, decimals)}
    </span>
  );
}

export default AnimatedNumber;
