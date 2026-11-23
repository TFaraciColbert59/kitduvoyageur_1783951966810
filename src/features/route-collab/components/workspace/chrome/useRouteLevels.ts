'use client';

import { useEffect, useRef } from 'react';
import type { RouteWorkspaceApi } from '../WorkspaceContext';
import {
  LEVEL_STATE_KEY,
  afterClosing,
  historyMove,
  isEditableTarget,
  levelToClose,
  levelToDrop,
  levelsAboveBase,
  openLevelCount,
  stackDepthOf,
  type LevelState,
  type LevelTarget,
} from './levels';

/**
 * Applique la règle des deux niveaux (4.6) : un niveau qui s'ouvre remplace l'autre, et Échap ferme un seul
 * niveau (menu de la carte, détail superposé, sous-tiroir, puis le tiroir lui-même).
 *
 * Le retour du navigateur (et le bouton retour matériel) fait de même : chaque niveau ouvert empile UNE entrée
 * d'historique (`history.pushState`, même adresse), et `popstate` ferme le niveau le plus haut. Un niveau fermé
 * autrement (croix, Échap) dépile ses entrées. Aucune navigation Next n'est touchée : on n'écrit ni l'adresse ni
 * `window.location`, et quand la page est quittée par un changement de route, l'historique n'est pas retouché.
 */
export function useRouteLevels(ws: RouteWorkspaceApi): void {
  const { subDrawer, setSubDrawer, overlayDetail, setOverlayDetail, sheetOpen, setSheetOpen, mapMenuOpen, setMapMenuOpen } = ws;
  const overlayKind = overlayDetail ? overlayDetail.kind : null;

  // Un sous-tiroir qui s'ouvre referme le détail superposé ; un détail qui s'ouvre referme le sous-tiroir.
  useEffect(() => {
    if (subDrawer && levelToDrop({ subDrawer: true, overlay: !!overlayDetail }, 'sub-drawer') === 'overlay') {
      setOverlayDetail(null);
    }
    // seul un changement de sous-tiroir est une ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subDrawer]);
  useEffect(() => {
    if (overlayDetail && levelToDrop({ subDrawer: !!subDrawer, overlay: true }, 'overlay') === 'sub-drawer') {
      setSubDrawer(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayKind]);

  const close = (target: LevelTarget) => {
    if (target === 'map-menu') setMapMenuOpen(false);
    else if (target === 'overlay') setOverlayDetail(null);
    else if (target === 'sub-drawer') setSubDrawer(null);
    else if (target === 'sheet') setSheetOpen(false);
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isEditableTarget(event.target)) return;
      const target = levelToClose({ sheetOpen, subDrawer: !!subDrawer, overlay: !!overlayDetail, mapMenu: mapMenuOpen });
      if (target === 'none') return;
      event.preventDefault();
      close(target);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, subDrawer, overlayDetail, mapMenuOpen, setMapMenuOpen, setOverlayDetail, setSubDrawer, setSheetOpen]);

  /* ----- Retour du navigateur ----- */
  const levelState: LevelState = { sheetOpen, subDrawer: !!subDrawer, overlay: !!overlayDetail, mapMenu: mapMenuOpen };
  const levelRef = useRef(levelState);
  levelRef.current = levelState;
  const baseRef = useRef<number | null>(null);
  const pushedRef = useRef(0);
  const count = openLevelCount(levelState);
  const { depth, base } = levelsAboveBase(count, baseRef.current);
  baseRef.current = base;
  const depthRef = useRef(depth);
  depthRef.current = depth;

  // Chaque niveau ouvert empile une entrée ; un niveau fermé sans le retour la dépile.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const move = historyMove(depth, pushedRef.current);
    for (let i = 0; i < move.push; i += 1) {
      pushedRef.current += 1;
      try {
        window.history.pushState({ [LEVEL_STATE_KEY]: pushedRef.current }, '');
      } catch {
        pushedRef.current -= 1;
      }
    }
    if (move.back > 0) {
      pushedRef.current -= move.back;
      window.history.go(-move.back);
    }
  }, [depth]);

  // « Retour » : ferme le niveau le plus haut, un seul (autant que d'entrées sautées si le navigateur en saute).
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const stack = stackDepthOf(event.state);
      const open = depthRef.current;
      if (stack < open) {
        let s = levelRef.current;
        for (let i = open; i > stack; i -= 1) {
          const target = levelToClose(s);
          if (target === 'none') break;
          closeRef.current(target);
          s = afterClosing(s);
        }
        pushedRef.current = stack;
      } else if (stack > open) {
        // « Avant » vers une entrée de niveau qui n'est plus ouverte : on la quitte, rien ne se rouvre.
        pushedRef.current = open;
        window.history.go(-(stack - open));
      } else {
        pushedRef.current = stack;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Page quittée avec des niveaux ouverts : on rend l'historique propre seulement si nos entrées sont encore au
      // sommet (sinon un changement de route est passé par là : on n'y touche pas).
      const pushed = pushedRef.current;
      if (pushed > 0 && stackDepthOf(window.history.state) === pushed) {
        pushedRef.current = 0;
        window.history.go(-pushed);
      }
    };
  }, []);
}
