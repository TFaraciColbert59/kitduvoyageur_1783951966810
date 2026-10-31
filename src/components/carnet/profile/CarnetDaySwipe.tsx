'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { swipeStep } from './CarnetPages';

/**
 * Balayage des pages de la carte : **Résumé → J1 → J2 … → Jn**.
 *
 * Une seule grammaire de geste : le pas est celui du carrousel (`swipeStep`,
 * 40 px de course horizontale, jamais un geste vertical). Le balayage ne sort
 * jamais des bornes : à droite sur le Résumé et à gauche sur le dernier jour,
 * rien ne bouge et aucune page n'est créée. Le carrousel média (Posts,
 * Parcours, Étapes, Matériel, Nature, J’aime, Commentaires, Gérer) garde son
 * propre geste dans `.ckp-pages` : un balayage commencé dans la grille ne
 * change donc jamais de jour.
 */
/** Miroir de `--motion-control-duration` (tokens.css) : 220 ms. */
export const DAY_SWIPE_MS = 220;

export type DayDirection = 'next' | 'prev';

/** Pas de page pour un geste horizontal : +1 (jour suivant), -1, ou 0 (rien). */
export function dayStep(dx: number, dy: number): -1 | 0 | 1 {
  return swipeStep(dx, dy);
}

/** Page cible d'un pas, toujours dans les bornes `0 … count - 1`. */
export function dayTarget(index: number, step: -1 | 0 | 1, count: number): number {
  if (step === 0 || count <= 1) return index;
  return Math.max(0, Math.min(count - 1, index + step));
}

export interface DaySwipeOptions {
  /** Nombre de pages : le Résumé (page 0) plus une page par jour. */
  count: number;
  /** Page affichée, `0` = Résumé. */
  index: number;
  /** Reçoit la page cible : jamais hors bornes, jamais la page courante. */
  onChange: (next: number) => void;
}

export interface DaySwipeHandlers {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerCancel: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export interface DaySwipe {
  direction: DayDirection;
  handlers: DaySwipeHandlers;
}

/** Un geste commencé dans le carrousel média appartient au carrousel. */
function insidePages(target: EventTarget | null): boolean {
  const node = target as Element | null;
  return Boolean(node && typeof node.closest === 'function' && node.closest('.ckp-pages'));
}

/**
 * Geste et clavier du balayage. Les handlers se posent sur la carte entière ;
 * le clavier ne répond qu'aux flèches non déjà traitées par un enfant (le
 * carrousel appelle `preventDefault`, donc `defaultPrevented` l'exclut).
 */
export function useDaySwipe({ count, index, onChange }: DaySwipeOptions): DaySwipe {
  const [direction, setDirection] = useState<DayDirection>('next');
  const start = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (step: -1 | 0 | 1) => {
      const target = dayTarget(index, step, count);
      if (target === index) return;
      setDirection(step > 0 ? 'next' : 'prev');
      onChange(target);
    },
    [count, index, onChange],
  );

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (insidePages(event.target)) return;
    start.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const origin = start.current;
      start.current = null;
      if (!origin) return;
      go(dayStep(event.clientX - origin.x, event.clientY - origin.y));
    },
    [go],
  );

  const onPointerCancel = useCallback(() => {
    start.current = null;
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (insidePages(event.target)) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(-1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        if (index !== 0) {
          setDirection('prev');
          onChange(0);
        }
      } else if (event.key === 'End') {
        event.preventDefault();
        if (index !== count - 1) {
          setDirection('next');
          onChange(count - 1);
        }
      }
    },
    [count, go, index, onChange],
  );

  return {
    direction,
    handlers: { onPointerDown, onPointerUp, onPointerCancel, onKeyDown },
  };
}

/**
 * Classe d'animation de la carte, redémarrée à chaque changement de page.
 *
 * L'élément n'est jamais remonté : le focus, les images décodées et le
 * carrousel restent en place. La classe est retirée puis reposée à l'image
 * suivante, seule façon de rejouer une animation CSS sur un nœud stable.
 * `prefers-reduced-motion` coupe la translation côté feuille de style.
 */
export function useDayMotion(index: number, direction: DayDirection): string {
  const [animation, setAnimation] = useState('');
  const previous = useRef(index);

  useEffect(() => {
    if (previous.current === index) return;
    previous.current = index;
    setAnimation('');
    const frame =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => setAnimation(direction === 'prev' ? 'ckp-day--prev' : 'ckp-day--next'))
        : (setTimeout(
            () => setAnimation(direction === 'prev' ? 'ckp-day--prev' : 'ckp-day--next'),
            16,
          ) as unknown as number);
    return () => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      else clearTimeout(frame);
    };
  }, [direction, index]);

  return animation;
}

export default useDaySwipe;
