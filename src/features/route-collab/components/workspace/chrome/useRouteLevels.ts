'use client';

import { useEffect } from 'react';
import type { RouteWorkspaceApi } from '../WorkspaceContext';
import { isEditableTarget, levelToClose, levelToDrop } from './levels';

/**
 * Applique la règle des deux niveaux (4.6) : un niveau qui s'ouvre remplace l'autre, et Échap ferme un seul
 * niveau (menu de la carte, détail superposé, sous-tiroir, puis le tiroir lui-même).
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isEditableTarget(event.target)) return;
      const target = levelToClose({ sheetOpen, subDrawer: !!subDrawer, overlay: !!overlayDetail, mapMenu: mapMenuOpen });
      if (target === 'none') return;
      event.preventDefault();
      if (target === 'map-menu') setMapMenuOpen(false);
      else if (target === 'overlay') setOverlayDetail(null);
      else if (target === 'sub-drawer') setSubDrawer(null);
      else setSheetOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen, subDrawer, overlayDetail, mapMenuOpen, setMapMenuOpen, setOverlayDetail, setSubDrawer, setSheetOpen]);
}
