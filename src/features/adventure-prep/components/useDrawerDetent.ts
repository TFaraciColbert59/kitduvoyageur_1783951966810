'use client';

import * as React from 'react';
import type { SheetDetent } from '@/components/ui';
import {
  drawerDetent,
  measureDrawerContent,
  type DrawerContext,
  type DrawerId,
  type DrawerMeasurement,
} from '../engine/drawerHeight';
import type { AdventurePrepDraft } from '../types';

/**
 * La hauteur du tiroir, decidee par ce qu il contient — C14.
 *
 * Le defaut etait une table `tiroir -> detent` ecrite a la main. Elle
 * mentait des la premiere ligne : `gear`, `consumables` et `participants`
 * etaient forces sur 90 dvh, alors qu un tiroir qui n affiche que deux
 * lignes laisse 80 % de verre vide. Un ecran « a moitie vide » se lit comme
 * une panne, pas comme un choix.
 *
 * Ce hook ne decide rien : il MESURE, puis confie l arbitrage a
 * `drawerDetent` (moteur pur, testable sans DOM). Deux regimes :
 *
 *   - dans le navigateur, un `ResizeObserver` sur le contenu rend la mesure
 *     reelle — la regle de remplissage s applique a ce qui est affiche ;
 *   - avant la premiere mesure, et sous `renderToStaticMarkup` ou en
 *     environnement sans `ResizeObserver`, c est le nombre de lignes REELLES
 *     du brouillon qui tranche. Aucune valeur codee en dur.
 *
 * Le `large` est plafonne a `max-h-[90dvh]` par `.lkv-sheet-up` : c est donc
 * cette hauteur la qui sert de reference, et non la hauteur du tiroir
 * courant — sinon la mesure se mordrait la queue (un tiroir `auto` se
 * mesurerait « plein », puisqu il colle a son contenu).
 */

/** Part de la fenetre qu un tiroir peut occuper au maximum. */
export const PANEL_OF_VIEWPORT = 0.9;

function sameMeasurement(
  previous: DrawerMeasurement | null,
  next: DrawerMeasurement | null,
): boolean {
  if (previous === null || next === null) return previous === next;
  return (
    previous.contentHeightPx === next.contentHeightPx &&
    previous.viewportHeightPx === next.viewportHeightPx
  );
}

/** La hauteur de reference : celle que le tiroir pourrait atteindre. */
function panelHeightPx(): number {
  if (typeof window === 'undefined') return 0;
  const height = window.visualViewport?.height ?? window.innerHeight;
  if (!Number.isFinite(height) || height <= 0) return 0;
  return height * PANEL_OF_VIEWPORT;
}

export interface DrawerDetentBinding {
  /** Le detent a passer au `Sheet`. */
  detent: SheetDetent;
  /** A poser sur le `<div data-prep-drawer-content>` qui enveloppe le corps. */
  contentRef: React.RefCallback<HTMLDivElement>;
}

export function useDrawerDetent(
  id: DrawerId | null,
  draft: AdventurePrepDraft,
  context: DrawerContext = {},
): DrawerDetentBinding {
  const [measurement, setMeasurement] = React.useState<DrawerMeasurement | null>(null);
  const nodeRef = React.useRef<HTMLDivElement | null>(null);

  const contentRef = React.useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
  }, []);

  // Changer de tiroir remet la mesure a zero : celle du tiroir precedent ne
  // dit rien du suivant, et la garder ferait monter un tiroir court parce
  // qu un autre etait long.
  React.useEffect(() => {
    setMeasurement(null);
  }, [id]);

  React.useEffect(() => {
    if (id === null || typeof window === 'undefined') return;
    const read = () => {
      const next = measureDrawerContent(nodeRef.current, panelHeightPx());
      setMeasurement((previous) => (sameMeasurement(previous, next) ? previous : next));
    };
    // Le contenu vient d etre monte : on mesure tout de suite, sans attendre
    // un evenement. Le premier rendu garde le detent derive du brouillon.
    read();
    const node = nodeRef.current;
    const observer =
      node && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    if (observer && node) observer.observe(node);
    window.addEventListener('resize', read);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', read);
    };
  }, [id, draft]);

  return {
    detent: id === null ? 'auto' : drawerDetent(id, draft, measurement, context),
    contentRef,
  };
}

export default useDrawerDetent;