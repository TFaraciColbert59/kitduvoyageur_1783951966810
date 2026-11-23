// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useRouteLevels } from '../components/workspace/chrome/useRouteLevels';
import {
  LEVEL_STATE_KEY,
  afterClosing,
  historyMove,
  levelsAboveBase,
  openLevelCount,
  stackDepthOf,
} from '../components/workspace/chrome/levels';
import type { RouteWorkspaceApi } from '../components/workspace/WorkspaceContext';

/** Un espace réduit à ce que la règle des niveaux lit : le tiroir, un sous-tiroir, un détail, le menu de la carte. */
let api: {
  setSheetOpen: (v: boolean) => void;
  setSubDrawer: (v: string | null) => void;
  setOverlayDetail: (v: { kind: string } | null) => void;
  setMapMenuOpen: (v: boolean) => void;
  state: () => { sheet: boolean; sub: string | null; overlay: boolean; menu: boolean };
};

function Harness({ sheetAtStart = true }: { sheetAtStart?: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(sheetAtStart);
  const [subDrawer, setSubDrawer] = useState<string | null>(null);
  const [overlayDetail, setOverlayDetail] = useState<{ kind: string } | null>(null);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  api = {
    setSheetOpen,
    setSubDrawer,
    setOverlayDetail,
    setMapMenuOpen,
    state: () => ({ sheet: sheetOpen, sub: subDrawer, overlay: !!overlayDetail, menu: mapMenuOpen }),
  };
  useRouteLevels({
    sheetOpen,
    setSheetOpen,
    subDrawer,
    setSubDrawer,
    overlayDetail,
    setOverlayDetail,
    mapMenuOpen,
    setMapMenuOpen,
  } as unknown as RouteWorkspaceApi);
  return <div data-testid="h" />;
}

const depthInHistory = () => stackDepthOf(window.history.state);

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '');
});

describe('niveaux : fonctions pures du retour navigateur (4.6)', () => {
  it('compte les niveaux, la base et les mouvements d’historique', () => {
    expect(openLevelCount({ sheetOpen: true, subDrawer: true, overlay: false, mapMenu: false })).toBe(2);
    expect(openLevelCount({ sheetOpen: true, subDrawer: true, overlay: true, mapMenu: true })).toBe(3);
    expect(levelsAboveBase(1, null)).toEqual({ depth: 0, base: 1 });
    expect(levelsAboveBase(2, 1)).toEqual({ depth: 1, base: 1 });
    expect(levelsAboveBase(0, 1)).toEqual({ depth: 0, base: 0 });
    expect(historyMove(2, 0)).toEqual({ push: 2, back: 0 });
    expect(historyMove(0, 2)).toEqual({ push: 0, back: 2 });
    expect(historyMove(1, 1)).toEqual({ push: 0, back: 0 });
    expect(stackDepthOf(null)).toBe(0);
    expect(stackDepthOf({ [LEVEL_STATE_KEY]: 2 })).toBe(2);
    expect(stackDepthOf({ [LEVEL_STATE_KEY]: 'x' })).toBe(0);
  });
  it('afterClosing ferme exactement le niveau le plus haut', () => {
    const s = { sheetOpen: true, subDrawer: true, overlay: false, mapMenu: true };
    expect(afterClosing(s)).toEqual({ ...s, mapMenu: false });
    expect(afterClosing(afterClosing(s))).toEqual({ ...s, mapMenu: false, subDrawer: false });
  });
});

describe('4.6 : le retour du navigateur ferme un seul niveau', () => {
  it('ouvrir un sous-tiroir empile une entrée ; « Retour » le ferme et laisse le tiroir ouvert', async () => {
    render(<Harness />);
    const before = window.history.length;
    expect(depthInHistory()).toBe(0);
    act(() => api.setSubDrawer('kit'));
    expect(depthInHistory()).toBe(1);
    expect(window.history.length).toBe(before + 1);
    act(() => window.history.back());
    await waitFor(() => expect(api.state().sub).toBeNull());
    expect(api.state().sheet).toBe(true);
    expect(depthInHistory()).toBe(0);
  });

  it('deux niveaux (menu de la carte puis sous-tiroir) : un retour par niveau, le plus haut d’abord', async () => {
    render(<Harness />);
    act(() => api.setSubDrawer('kit'));
    act(() => api.setMapMenuOpen(true));
    expect(depthInHistory()).toBe(2);
    act(() => window.history.back());
    await waitFor(() => expect(api.state().menu).toBe(false));
    expect(api.state().sub).toBe('kit');
    act(() => window.history.back());
    await waitFor(() => expect(api.state().sub).toBeNull());
    expect(api.state().sheet).toBe(true);
  });

  it('un niveau fermé autrement (croix, Échap) dépile son entrée : pas d’entrée fantôme', async () => {
    render(<Harness />);
    act(() => api.setSubDrawer('kit'));
    expect(depthInHistory()).toBe(1);
    act(() => api.setSubDrawer(null));
    await waitFor(() => expect(depthInHistory()).toBe(0));
    expect(api.state().sheet).toBe(true);
  });

  it('le tiroir ouvert à l’arrivée n’est pas un piège : aucune entrée empilée', () => {
    render(<Harness />);
    expect(depthInHistory()).toBe(0);
    act(() => api.setOverlayDetail({ kind: 'day' }));
    expect(depthInHistory()).toBe(1);
  });

  it('n’écrit jamais l’adresse : même URL avant et après', () => {
    const url = window.location.href;
    render(<Harness />);
    act(() => api.setSubDrawer('kit'));
    expect(window.location.href).toBe(url);
  });

  it('page quittée avec un niveau ouvert : l’historique est nettoyé', async () => {
    const { unmount } = render(<Harness />);
    act(() => api.setSubDrawer('kit'));
    expect(depthInHistory()).toBe(1);
    unmount();
    await waitFor(() => expect(depthInHistory()).toBe(0));
  });

  it('page quittée par un changement de route (l’entrée du sommet n’est plus la nôtre) : rien n’est touché', () => {
    const { unmount } = render(<Harness />);
    act(() => api.setSubDrawer('kit'));
    window.history.pushState({ __NA: true }, '', window.location.href);
    const len = window.history.length;
    unmount();
    expect(window.history.length).toBe(len);
    expect(stackDepthOf(window.history.state)).toBe(0);
  });
});
