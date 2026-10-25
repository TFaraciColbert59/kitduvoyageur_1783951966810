'use client';

import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * P1-3 (fin) — Base des icônes animées : framer-motion remplacé par des
 * animations CSS (classes `lkv-ia-*`, cf. tailwind.css). Sort du graphe
 * racine le dernier importeur framer-motion (LkvIcon → 27 icônes).
 *
 * Contrat identique à l'ancienne implémentation :
 * - forwardRef startAnimation/stopAnimation (classe `lkv-ia-run`) ;
 * - survol/appui autonomes SAUF si un ref externe est fourni (contrôlé) ;
 * - `prefers-reduced-motion` respecté (CSS).
 */

export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface AnimatedIconBaseProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

export const AnimatedIconBase = forwardRef<
  AnimatedIconHandle,
  AnimatedIconBaseProps
>(({ className, children, onClick, ...props }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const play = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.classList.remove('lkv-ia-run');
    // Reflow : rejoue l'animation même si elle est déjà en cours.
    void el.offsetWidth;
    el.classList.add('lkv-ia-run');
  }, []);

  useImperativeHandle(
    ref,
    () => {
      // Un consommateur qui passe un ref pilote l'animation lui-même :
      // on coupe le déclenchement autonome au survol (parité avec l'ancien
      // comportement `isControlledRef`).
      containerRef.current?.classList.add('lkv-ia-controlled');
      return {
        startAnimation: play,
        stopAnimation: () => containerRef.current?.classList.remove('lkv-ia-run'),
      };
    },
    [play]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onClick?.(e);
      if (!containerRef.current?.classList.contains('lkv-ia-controlled')) play();
    },
    [onClick, play]
  );

  return (
    <div
      ref={containerRef}
      className={cn('lkv-ia inline-flex', className)}
      {...props}
      onClick={handleClick}
    >
      {children}
    </div>
  );
});

AnimatedIconBase.displayName = 'AnimatedIconBase';
