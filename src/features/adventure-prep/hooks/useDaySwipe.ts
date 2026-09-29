'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { TouchEvent } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { dayAfterSwipe, swipeIntent } from '../engine/dayNavigation';

/**
 * Balayage de jour — le geste que l'ecran designait deja sans le dire.
 *
 * `swipeIntent` et `dayAfterSwipe` savaient depuis le debut ce qu'un geste
 * veut dire et quel jour il vise ; aucun composant ne les appelait. Ce hook est
 * le seul endroit ou la decision est prise, et il ne fait qu'ORCHESTRER les
 * deux fonctions pures du moteur : aucun seuil, aucun sens et aucun carrousel
 * ne sont reimplementes ici.
 *
 * Deux regles non negociables :
 * - on ne fait JAMAIS `preventDefault`. Le programme du jour est une liste
 *   verticale ; bloquer le defilement casserait la lecture. C'est la dominance
 *   horizontale de `swipeIntent` qui refuse le scroll, pas une annulation ;
 * - le swipe n'est jamais le SEUL chemin. Le rail de jours reste rendu et
 *   focusable ; ce hook n'ajoute qu'un raccourci, pas un acces unique.
 */

export interface DaySwipeOptions {
  /** Jour affiche : `null` = vue « Ensemble ». */
  readonly current: number | null;
  /** Nombre de journees du programme. Sous deux, il n'y a rien a balayer. */
  readonly days: number;
  /** Applique le jour vise par le geste. */
  readonly onSelectDay: (day: number | null) => void;
  /**
   * Zones qui gardent leurs propres gestes. Par defaut : la carte, qui possede
   * deja son pincement et son appui long.
   */
  readonly ignore?: (target: EventTarget | null) => boolean;
}

export interface DaySwipeHandlers {
  readonly onTouchStart: (event: TouchEvent<Element>) => void;
  readonly onTouchMove: (event: TouchEvent<Element>) => void;
  readonly onTouchEnd: (event: TouchEvent<Element>) => void;
  readonly onTouchCancel: () => void;
}

interface Origin {
  readonly x: number;
  readonly y: number;
}

/**
 * La carte a ses propres gestes : un balayage qui y commence lui appartient.
 *
 * Le selecteur porte la classe de surface reelle (`prep-map`), pas la
 * variante de taille : le geste est protege a la fois sur la carte posee dans
 * le programme et sur celle ouverte en plein ecran.
 */
export function isInsideMap(target: EventTarget | null): boolean {
  const node = target as Element | null;
  return typeof node?.closest === 'function' && node.closest('.prep-map') !== null;
}

export function useDaySwipe(options: DaySwipeOptions): DaySwipeHandlers {
  const { current, days, onSelectDay, ignore = isInsideMap } = options;
  const origin = useRef<Origin | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  const onTouchStart = useCallback(
    (event: TouchEvent<Element>) => {
      // Un pincement a deux doigts n'est jamais un balayage de jour : on ne
      // memorise rien plutot que de memoriser un geste qui n'en est pas un.
      const touch = event.touches.length === 1 ? event.touches[0] : undefined;
      if (!touch || ignore(event.target)) {
        origin.current = null;
        return;
      }
      origin.current = { x: touch.clientX, y: touch.clientY };
    },
    [ignore],
  );

  // Volontairement sans effet, et surtout sans `preventDefault` : le defilement
  // vertical du programme doit rester natif. Le tri des gestes se fait a la
  // levee, sur l'axe dominant.
  const onTouchMove = useCallback(() => undefined, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent<Element>) => {
      const start = origin.current;
      origin.current = null;
      if (!start) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      // Sous deux journees le rail de jours n'est pas rendu : aucune navigation
      // ne doit exister derriere, sinon l'etat bouge sans que rien ne
      // l'annonce a l'ecran.
      if (!Number.isInteger(days) || days < 2) return;

      const intent = swipeIntent(touch.clientX - start.x, touch.clientY - start.y);
      if (intent === null) return;

      const next = dayAfterSwipe(current, days, intent);
      // Resistance aux bords : le carrousel du moteur est ferme, donc aucun
      // geste ne finit sur une impasse. Mais un geste qui ne changerait rien ne
      // doit surtout pas non plus ecrire dans le store.
      if (next === current) return;

      // Retour haptique : un SEUL aller-retour par geste reellement effectue.
      // Il part apres la resistance aux bords, donc un geste refuse ne vibre
      // pas, et avant l ecriture, donc la secousse est simultanee au changement
      // d ecran. `triggerNativeHaptic` respecte `prefers-reduced-motion`.
      triggerHaptic('selection');
      onSelectDay(next);
    },
    [current, days, onSelectDay, triggerHaptic],
  );

  // Un geste annule par le systeme (appel entrant, scroll vole) ne laisse
  // aucun point de depart derriere lui.
  const onTouchCancel = useCallback(() => {
    origin.current = null;
  }, []);

  return useMemo(
    () => ({ onTouchStart, onTouchMove, onTouchEnd, onTouchCancel }),
    [onTouchStart, onTouchMove, onTouchEnd, onTouchCancel],
  );
}