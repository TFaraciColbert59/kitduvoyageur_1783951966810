// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGpsTracker } from '@/features/explorer-v2/activity/useGpsTracker';
import type { GpsFix } from '@/features/explorer-v2/activity/tracker';
import {
  AUTO_PAUSE_STORAGE_KEY,
  useExplorerStore,
} from '@/features/explorer-v2/state/store';

/**
 * Le hors-trace est une alerte de sécurité : son buffer doit rester
 * chronologique même quand l'horloge murale saute ou qu'une nouvelle borne est
 * ouverte après un rejet. On utilise le buffer réel, sans mocker
 * `evaluateOffRoute`.
 */

const LAT0 = 45.92;
const LNG0 = 6.87;
const M_PER_DEG_LAT = 111320;

function at(t: number, distanceM: number, speedMs = 1, receivedAt?: number): GpsFix {
  return {
    t,
    lat: LAT0 + distanceM / M_PER_DEG_LAT,
    lng: LNG0,
    ele: 1200,
    acc: 5,
    speed: speedMs,
    ...(receivedAt === undefined ? {} : { receivedAt }),
  };
}

function push(fix: GpsFix): void {
  const target = window as Window & { __xpPushFix?: (next: GpsFix) => void };
  act(() => target.__xpPushFix?.(fix));
}

async function mountTracker(): Promise<void> {
  renderHook(() => useGpsTracker({ distanceToRouteM: () => 80 }));
  await waitFor(() => {
    const target = window as Window & { __xpPushFix?: unknown };
    expect(typeof target.__xpPushFix).toBe('function');
  });
}

beforeEach(() => {
  window.localStorage.removeItem(AUTO_PAUSE_STORAGE_KEY);
  useExplorerStore.setState({
    activity: undefined,
    summary: undefined,
    summarySaved: undefined,
    autoPauseEnabled: true,
    locationPermission: 'granted',
    scene: undefined,
    sheet: 'level',
    detent: 'peek',
    camera: { type: 'none' },
    center: [LNG0, LAT0],
    zoom: 11,
    toast: undefined,
  });
});

afterEach(cleanup);

describe('explorer-v2 · hors-trace et horloges', () => {
  it('ne déclenche pas l’alerte sur un saut d’horloge avant', async () => {
    useExplorerStore.getState().startActivity('rando');
    await mountTracker();

    push(at(0, 0, 1, 0));
    push(at(5_000, 5, 1, 1_000));
    // 30 s annoncées, 1 s réellement reçue : le tracker corrige l'instant.
    push(at(35_000, 10, 1, 2_000));
    expect(useExplorerStore.getState().activity?.offRoute).toBe(false);

    push(at(40_000, 15, 1, 3_000));
    expect(useExplorerStore.getState().activity?.offRoute).toBe(false);

    // 16 s après la première mesure hors trace : l'alerte est légitime.
    push(at(45_000, 20, 1, 4_000));
    expect(useExplorerStore.getState().activity?.offRoute).toBe(true);
  });

  it('repart d’un buffer neuf après un saut d’horloge arrière', async () => {
    useExplorerStore.getState().startActivity('rando');
    await mountTracker();

    push(at(3_595_000, 0, 1));
    push(at(3_600_000, 5, 1));
    expect(useExplorerStore.getState().activity?.offRoute).toBe(false);

    // Premier fix dans l'époque basse : point périmé rejeté.
    push(at(6_000, 10, 1));
    expect(useExplorerStore.getState().activity?.offRoute).toBe(false);

    // Deuxième fix consécutif : l'horloge a reculé, nouvelle borne.
    push(at(11_000, 15, 1));
    expect(useExplorerStore.getState().activity?.offRoute).toBe(false);

    // 15 s dans la nouvelle époque, pas 3 589 s négatives.
    push(at(26_000, 20, 1));
    expect(useExplorerStore.getState().activity?.offRoute).toBe(true);
  });

  it('ne relie pas le hors-trace à travers un rejet suivi d’un trou', async () => {
    useExplorerStore.getState().startActivity('rando');
    await mountTracker();

    push(at(0, 0, 1));
    push(at(5_000, 5, 1));
    push({ ...at(6_000, 10, 1), acc: 120 });
    expect(useExplorerStore.getState().activity?.offRoute).toBe(false);

    // Le premier fix valide après le rejet ouvre une nouvelle borne, même si
    // le trou dépasse maxFixGapS : le buffer doit repartir de zéro.
    push(at(200_000, 1_005, 1));
    expect(useExplorerStore.getState().activity?.offRoute).toBe(false);

    push(at(215_000, 1_010, 1));
    expect(useExplorerStore.getState().activity?.offRoute).toBe(true);
  });
});
