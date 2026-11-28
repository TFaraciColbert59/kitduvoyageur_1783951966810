// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  DISCOVERY_STEPS,
  getStepsForSurface,
  resolveDiscoverySurface,
} from '../catalog';
import {
  DISCOVERY_COOLDOWN_MS,
  DISCOVERY_ENTRY_DELAY_MS,
  __resetDiscoveryStoreForTest,
  activateDiscoveryStep,
  completeDiscoveryStep,
  dismissDiscoveryStep,
  getDiscoveryProgress,
  getDiscoverySnapshot,
  pickNextDiscoveryStep,
  resetDiscovery,
  setDiscoveryEnabled,
} from '../store';
import { DiscoveryHost } from '../DiscoveryHost';

let mockedPathname = '/explorer';

vi.mock('next/navigation', () => ({
  usePathname: () => mockedPathname,
}));

describe('Discovery catalog & timeline store', () => {
  beforeEach(() => {
    __resetDiscoveryStoreForTest();
    mockedPathname = '/explorer';
    document.body.classList.remove('lkdv-dialog-open');
  });

  it('résout les surfaces principales LKDV sans faux positifs', () => {
    expect(resolveDiscoverySurface('/explorer')).toBe('explorer');
    expect(resolveDiscoverySurface('/communaute')).toBe('communaute');
    expect(resolveDiscoverySurface('/carnets/abc-123')).toBe('carnets');
    expect(resolveDiscoverySurface('/clubs/alpin')).toBe('clubs');
    expect(resolveDiscoverySurface('/hub')).toBe('hub');
    expect(resolveDiscoverySurface('/messagerie')).toBe('messagerie');
    expect(resolveDiscoverySurface('/kit-studio')).toBe('kit-studio');
    expect(resolveDiscoverySurface('/compte')).toBe('compte');
    expect(resolveDiscoverySurface('/cgu')).toBeNull();
  });

  it('respecte l’ordre strict sur /explorer et empêche deux repères simultanés', () => {
    const explorerSteps = getStepsForSurface('explorer');
    expect(explorerSteps[0]?.id).toBe('explorer-planner');
    expect(explorerSteps[1]?.id).toBe('explorer-play');

    const first = pickNextDiscoveryStep('/explorer', getDiscoverySnapshot(), () => true);
    expect(first?.id).toBe('explorer-planner');

    expect(activateDiscoveryStep('explorer-planner')).toBe(true);
    // Impossible d'activer un second repère tant que le premier est actif
    expect(activateDiscoveryStep('explorer-play')).toBe(false);
    expect(pickNextDiscoveryStep('/explorer', getDiscoverySnapshot(), () => true)).toBeNull();

    // Validation du premier -> cooldown posé et passage au suivant
    const t0 = 10_000;
    completeDiscoveryStep('explorer-planner', t0);
    const snap = getDiscoverySnapshot();
    expect(snap.activeStepId).toBeNull();
    expect(snap.completedIds).toContain('explorer-planner');
    expect(snap.cooldownUntil).toBe(t0 + DISCOVERY_COOLDOWN_MS);

    const second = pickNextDiscoveryStep('/explorer', snap, () => true);
    expect(second?.id).toBe('explorer-play');
  });

  it('ne renvoie plus un repère déjà replié, sauf après réinitialisation', () => {
    activateDiscoveryStep('explorer-planner');
    dismissDiscoveryStep('explorer-planner', 20_000);
    expect(getDiscoverySnapshot().dismissedIds).toContain('explorer-planner');

    const progress = getDiscoveryProgress(getDiscoverySnapshot());
    expect(progress.seenCount).toBe(1);
    expect(progress.completedCount).toBe(0);
    expect(progress.totalCount).toBe(DISCOVERY_STEPS.length);

    resetDiscovery(25_000);
    const resetSnap = getDiscoverySnapshot();
    expect(resetSnap.completedIds).toHaveLength(0);
    expect(resetSnap.dismissedIds).toHaveLength(0);
    expect(resetSnap.enabled).toBe(true);
  });

  it('désactive proprement tout déclenchement quand enabled = false', () => {
    setDiscoveryEnabled(false);
    expect(pickNextDiscoveryStep('/explorer', getDiscoverySnapshot(), () => true)).toBeNull();
    expect(activateDiscoveryStep('explorer-planner')).toBe(false);
  });

  it('priorise les repères universels drawer quand un tiroir modal ou déployé est ouvert', () => {
    // Tiroir modal ouvert : ne propose jamais un bouton de page derrière
    const modalStep = pickNextDiscoveryStep(
      '/communaute',
      getDiscoverySnapshot(),
      (anchor) => anchor === 'community-create' || anchor === 'drawer-grabber',
      { modalDrawerOpen: true },
    );
    expect(modalStep?.id).toBe('drawer-grabber');

    // Tiroir Explorer déployé (mid/full) : priorise les repères tiroir
    const expandedStep = pickNextDiscoveryStep(
      '/explorer',
      getDiscoverySnapshot(),
      (anchor) => anchor === 'explorer-planner' || anchor === 'drawer-lenses',
      { drawerExpanded: true },
    );
    expect(expandedStep?.id).toBe('drawer-lenses');
  });
});

describe('DiscoveryHost DOM orchestration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetDiscoveryStoreForTest();
    mockedPathname = '/explorer';
    document.body.classList.remove('lkdv-dialog-open');
  });

  it('fait vibrer l’ancre crayon sur /explorer, affiche l’îlot, puis valide au clic sur le crayon', () => {
    const targetBtn = document.createElement('button');
    targetBtn.setAttribute('data-discover', 'explorer-planner');
    targetBtn.getBoundingClientRect = () =>
      ({
        top: 100,
        left: 100,
        bottom: 140,
        right: 140,
        width: 40,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(targetBtn);

    render(<DiscoveryHost />);

    // Rien avant le délai d'entrée doux
    expect(screen.queryByText('Trace ton itinéraire')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(DISCOVERY_ENTRY_DELAY_MS + 50);
    });

    // L'îlot est visible et le crayon vibre via data-discover-active="true"
    expect(screen.getByText('Trace ton itinéraire')).toBeTruthy();
    expect(targetBtn.getAttribute('data-discover-active')).toBe('true');

    // L'utilisateur clique sur le crayon -> validation immédiate et arrêt de la vibration
    fireEvent.pointerDown(targetBtn);
    expect(targetBtn.getAttribute('data-discover-active')).toBeNull();
    expect(screen.queryByText('Trace ton itinéraire')).toBeNull();
    expect(getDiscoverySnapshot().completedIds).toContain('explorer-planner');

    targetBtn.remove();
    vi.useRealTimers();
  });
});
