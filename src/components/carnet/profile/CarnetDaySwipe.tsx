'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Balayage des pages de la carte : **Résumé → J1 → J2 … → Jn**.
 *
 * Une seule grammaire de geste pour la carte entière : 40 px de course
 * horizontale, jamais un geste vertical. Le geste se lit au **doigt** comme à la
 * souris et au stylet, et le clavier garde les flèches. Le balayage ne sort
 * jamais des bornes : à droite sur le Résumé et à gauche sur le dernier jour,
 * rien ne bouge et aucune page n'est créée. Un glissement horizontal n'importe
 * où dans la carte — grille, volets, en-tête — change donc UNIQUEMENT de jour ;
 * le carrousel média s'ouvre depuis la barre du haut et le menu `···`.
 */
export const DAY_SWIPE_MS = 220;

/** Course horizontale minimale d'un pas de page. */
export const SWIPE_MIN_PX = 40;

export type DayDirection = 'next' | 'prev';

/**
 * Pas de page pour un geste horizontal : +1 (jour suivant), -1, ou 0 (rien).
 * Un geste vertical ou trop court ne consomme jamais le geste : le défilement
 * de la carte garde la main.
 */
export function dayStep(dx: number, dy: number): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}

/** Alias historique : même pas, même seuil, une seule grammaire de geste. */
export const swipeStep = dayStep;

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
  /**
   * Le doigt a sa propre grammaire : sur un écran tactile le navigateur émet
   * aussi des événements pointeur, donc le pointeur se tait dès que
   * `pointerType` vaut `touch` (ou `pen`) et le geste se lit ici. Aucun
   * `preventDefault` n'est nécessaire : le geste ne consomme jamais le
   * défilement vertical, et le clic fantôme est avalé en capture.
   */
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
  onTouchCancel: () => void;
  /**
   * Un glissement ne clique jamais : après un pas, le clic qui suit le geste
   * (tuile, bouton, segment) est avalé en phase de capture, avant l'enfant.
   */
  onClickCapture: (event: React.MouseEvent) => void;
}

export interface DaySwipe {
  direction: DayDirection;
  handlers: DaySwipeHandlers;
}

/**
 * Le clavier des jours ne prend jamais la main à un autre composant : le
 * carrousel (flèches), une feuille ouverte (post, photo), un champ de saisie.
 */
const KEYBOARD_BLOCKERS = [
  '.ckp-pages',
  '.ckp-post-sheet',
  '.ckp-viewer',
  '[role="dialog"]',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
].join(', ');

function keyboardBlocked(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return true;
  const node = event.target as Element | null;
  if (!node || typeof node.closest !== 'function') return false;
  return Boolean(node.closest(KEYBOARD_BLOCKERS));
}

/**
 * Geste et clavier du balayage. Les handlers se posent sur la carte entière ;
 * le clavier ne répond qu'aux flèches non déjà traitées par un enfant (le
 * carrousel appelle `preventDefault`, donc `defaultPrevented` l'exclut).
 *
 * Trois entrées pour une seule règle : le doigt (`touchstart`/`touchmove`/
 * `touchend`), la souris et le stylet (`pointer*`), le clavier. Un geste tactile
 * émet aussi des événements pointeur : ceux-ci sont ignorés quand
 * `pointerType` vaut `touch`/`pen`, sinon un seul balayage ferait deux jours.
 */
export function useDaySwipe({ count, index, onChange }: DaySwipeOptions): DaySwipe {
  const [direction, setDirection] = useState<DayDirection>('next');
  const start = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const go = useCallback(
    (step: -1 | 0 | 1) => {
      const target = dayTarget(index, step, count);
      if (target === index) return;
      setDirection(step > 0 ? 'next' : 'prev');
      onChange(target);
    },
    [count, index, onChange],
  );

  const reset = useCallback(() => {
    start.current = null;
    latest.current = null;
  }, []);

  /* Souris et stylet. Le doigt est traité par les handlers tactiles. */
  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    swiped.current = false;
    start.current = { x: event.clientX, y: event.clientY };
    latest.current = null;
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const origin = start.current;
      reset();
      if (!origin) return;
      const step = dayStep(event.clientX - origin.x, event.clientY - origin.y);
      if (step === 0) return;
      /* Même aux bornes, le geste ne se transforme jamais en clic. */
      swiped.current = true;
      go(step);
    },
    [go, reset],
  );

  const onPointerCancel = useCallback(() => {
    reset();
  }, [reset]);

  /* Doigt : même seuil, même règle, mêmes bornes que la souris. */
  const onTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0] ?? event.changedTouches[0] ?? null;
    if (!touch) return;
    swiped.current = false;
    start.current = { x: touch.clientX, y: touch.clientY };
    latest.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0] ?? null;
    if (!touch) return;
    latest.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      const origin = start.current;
      /* `touchend` porte la position finale ; `lastTouch` couvre le cas d'un
         `changedTouches` vide (certains navigateurs, tests). */
      const end = event.changedTouches[0] ?? latest.current;
      reset();
      if (!origin || !end) return;
      const step = dayStep(end.clientX - origin.x, end.clientY - origin.y);
      if (step === 0) return;
      /* Le clic synthétique qui suit le geste est avalé en capture. */
      swiped.current = true;
      go(step);
    },
    [go, reset],
  );

  const onTouchCancel = useCallback(() => {
    reset();
  }, [reset]);

  const onClickCapture = useCallback((event: React.MouseEvent) => {
    if (!swiped.current) return;
    swiped.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  /* Le clavier est écouté au document : la carte reste pilotable même quand
     aucun de ses boutons n'a le focus, sans jamais voler une flèche au
     carrousel ou à une feuille ouverte. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (keyboardBlocked(event)) return;
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
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [count, go, index, onChange]);

  return {
    direction,
    handlers: {
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
      onClickCapture,
    },
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
