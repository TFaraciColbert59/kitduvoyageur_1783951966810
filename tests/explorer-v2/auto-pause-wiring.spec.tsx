// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGpsTracker } from '@/features/explorer-v2/activity/useGpsTracker';
import type { GpsFix } from '@/features/explorer-v2/activity/tracker';
import {
  AUTO_PAUSE_STORAGE_KEY,
  hydrateAutoPausePreference,
  useExplorerStore,
} from '@/features/explorer-v2/state/store';
import { LiveDirectTab, SportPicker } from '@/features/explorer-v2/sheet/SheetContent';
import type { SheetContext } from '@/features/explorer-v2/sheet/context';

/**
 * Raccordement S1.05 : le réglage de préparation choisit le profil du sport,
 * la pause automatique gèle les métriques sans couper la capture, et la pause
 * manuelle reste une action distincte qui ne bloque pas la reprise.
 */

const LAT0 = 45.92;
const LNG0 = 6.87;
const M_PER_DEG_LAT = 111320;

function at(t: number, distanceM: number, speedMs: number, ele = 1200): GpsFix {
  return {
    t,
    lat: LAT0 + distanceM / M_PER_DEG_LAT,
    lng: LNG0,
    ele,
    acc: 5,
    speed: speedMs,
  };
}

function push(fix: GpsFix): void {
  const target = window as Window & { __xpPushFix?: (next: GpsFix) => void };
  act(() => target.__xpPushFix?.(fix));
}

async function mountTracker() {
  const hook = renderHook(() => useGpsTracker());
  await waitFor(() => {
    const target = window as Window & { __xpPushFix?: unknown };
    expect(typeof target.__xpPushFix).toBe('function');
  });
  return hook;
}

function createActivity(sport: 'course' | 'rando' = 'course') {
  useExplorerStore.getState().startActivity(sport);
}

/** Parcours réel : switch rendu, hook GPS, puis onglet direct qui affiche la pause. */
function JourneyHarness() {
  useGpsTracker();
  const state = useExplorerStore();
  const ctx = { state, pois: [], units: 'metric' } as unknown as SheetContext;
  return (
    <>
      <SportPicker ctx={ctx} />
      <section data-testid="live-direct">
        <LiveDirectTab ctx={ctx} />
      </section>
    </>
  );
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
  });
});

afterEach(() => {
  cleanup();
});

describe('explorer-v2 · raccordement du réglage de pause automatique', () => {
  it('conserve le comportement historique quand le réglage est désactivé', async () => {
    useExplorerStore.setState({ autoPauseEnabled: false });
    createActivity('course');
    await mountTracker();

    push(at(0, 0, 1));
    push(at(5_000, 5, 1));
    push(at(70_000, 5_005, 1));

    const activity = useExplorerStore.getState().activity;
    expect(activity?.paused).toBe(false);
    expect(activity?.autoPaused).toBe(false);
    // Le trou de 65 s est compté comme avant, sans nouvelle sémantique.
    expect(activity?.distanceM).toBeGreaterThan(4_000);
  });

  it('ne transforme pas une interruption GPS en mouvement continu', async () => {
    createActivity('course');
    await mountTracker();

    push(at(0, 0, 1));
    push(at(5_000, 5, 1));
    push(at(70_000, 1_005, 1));

    const activity = useExplorerStore.getState().activity;
    expect(activity?.distanceM).toBeCloseTo(5, 1);
    expect(activity?.autoPaused).toBe(false);
  });

  it('gèle les métriques pendant la pause auto et laisse la capture nourrir la reprise', async () => {
    createActivity('course');
    await mountTracker();

    push(at(0, 0, 1));
    push(at(5_000, 5, 1));
    push(at(10_000, 10, 1));

    for (let t = 15; t <= 40; t += 5) {
      push(at(t * 1000, 10, 0));
    }

    let activity = useExplorerStore.getState().activity;
    expect(activity?.autoPaused).toBe(true);
    expect(activity?.paused).toBe(false);
    const frozen = {
      distanceM: activity?.distanceM ?? 0,
      movingS: activity?.movingS ?? 0,
      elevGainM: activity?.elevGainM ?? 0,
    };
    const centerBeforeDrift = useExplorerStore.getState().center;

    // Les fixes continuent d'arriver et dérivent : les métriques et la carte
    // restent gelées pendant la pause.
    push(at(45_000, 50, 0, 1300));
    push(at(50_000, 70, 0, 1300));
    expect(useExplorerStore.getState().center).toEqual(centerBeforeDrift);
    activity = useExplorerStore.getState().activity;
    expect(activity?.distanceM).toBe(frozen.distanceM);
    expect(activity?.movingS).toBe(frozen.movingS);
    expect(activity?.elevGainM).toBe(frozen.elevGainM);

    // Reprise automatique, puis la distance repart de la dernière position.
    push(at(55_000, 71, 1, 1300));
    activity = useExplorerStore.getState().activity;
    expect(activity?.autoPaused).toBe(false);
    expect(activity?.distanceM).toBe(frozen.distanceM);
    push(at(60_000, 76, 1, 1300));
    activity = useExplorerStore.getState().activity;
    expect(activity?.distanceM).toBeCloseTo(frozen.distanceM + 5, 1);
  });

  it.each([true, false])(
    'pause manuelle (auto %s) : ignore les fixes tardifs et coupe la continuité',
    async (enabled) => {
      useExplorerStore.setState({ autoPauseEnabled: enabled });
      createActivity('course');
      await mountTracker();

      push(at(0, 0, 1));
      push(at(5_000, 10, 1));
      const centerBeforePause = useExplorerStore.getState().center;

      act(() => useExplorerStore.getState().updateActivity({ paused: true }));
      push(at(10_000, 100, 1));
      let current = useExplorerStore.getState();
      expect(current.activity?.distanceM).toBeCloseTo(10, 1);
      // Le fix tardif ne déplace pas la carte : il est réellement ignoré.
      expect(current.center).toEqual(centerBeforePause);

      act(() =>
        useExplorerStore.getState().updateActivity({ paused: false, autoPaused: false }),
      );
      push(at(20_000, 200, 1));
      current = useExplorerStore.getState();
      expect(current.activity?.paused).toBe(false);
      expect(current.activity?.autoPaused).toBe(false);
      // Le premier fix après la pause est une nouvelle borne : pas de trou compté.
      expect(current.activity?.distanceM).toBeCloseTo(10, 1);

      push(at(25_000, 205, 1));
      current = useExplorerStore.getState();
      expect(current.activity?.distanceM).toBeCloseTo(15, 1);
    },
  );

  it('parcourt le switch rendu, le hook GPS et l’affichage de la pause', async () => {
    useExplorerStore.setState({ autoPauseEnabled: false });
    window.localStorage.removeItem(AUTO_PAUSE_STORAGE_KEY);
    render(<JourneyHarness />);

    const toggle = screen.getByRole('switch', { name: /Pause automatique/ });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    await act(async () => useExplorerStore.getState().startActivity('course'));
    await waitFor(() => {
      const target = window as Window & { __xpPushFix?: unknown };
      expect(typeof target.__xpPushFix).toBe('function');
    });

    // Switch OFF : l'arrêt ne déclenche aucune pause automatique.
    push(at(0, 0, 1));
    push(at(5_000, 5, 1));
    push(at(10_000, 10, 1));
    for (let t = 15; t <= 40; t += 5) push(at(t * 1000, 10, 0));
    expect(useExplorerStore.getState().activity?.autoPaused).toBe(false);

    // Switch ON rendu : le hook bascule sur le profil du sport.
    fireEvent.click(toggle);
    expect(useExplorerStore.getState().autoPauseEnabled).toBe(true);
    expect(
      screen.getByRole('switch', { name: /Pause automatique/ }).getAttribute('aria-checked'),
    ).toBe('true');

    for (let t = 45; t <= 70; t += 5) push(at(t * 1000, 10, 0));
    expect(useExplorerStore.getState().activity?.autoPaused).toBe(true);

    const live = screen.getByTestId('live-direct');
    expect(within(live).getByText('Pause automatique')).toBeTruthy();
    expect(within(live).getByText(/Arrêt détecté/)).toBeTruthy();
    expect(within(live).queryByText('Pause manuelle')).toBeNull();
  });

  it('hydrate une préférence stockée, avec ON par défaut (S1.05)', () => {
    expect(useExplorerStore.getInitialState().autoPauseEnabled).toBe(true);

    // Sans valeur stockée, le défaut reste actif, même si la session avait
    // été coupée avant un remontage.
    window.localStorage.removeItem(AUTO_PAUSE_STORAGE_KEY);
    useExplorerStore.setState({ autoPauseEnabled: false });
    hydrateAutoPausePreference();
    expect(useExplorerStore.getState().autoPauseEnabled).toBe(true);

    useExplorerStore.setState({ autoPauseEnabled: true });
    window.localStorage.setItem(AUTO_PAUSE_STORAGE_KEY, '0');
    hydrateAutoPausePreference();
    expect(useExplorerStore.getState().autoPauseEnabled).toBe(false);

    useExplorerStore.setState({ autoPauseEnabled: false });
    window.localStorage.setItem(AUTO_PAUSE_STORAGE_KEY, '1');
    hydrateAutoPausePreference();
    expect(useExplorerStore.getState().autoPauseEnabled).toBe(true);
  });

  it('persiste le réglage local et le rend réversible', () => {
    act(() => useExplorerStore.getState().setAutoPauseEnabled(false));
    expect(useExplorerStore.getState().autoPauseEnabled).toBe(false);
    expect(window.localStorage.getItem(AUTO_PAUSE_STORAGE_KEY)).toBe('0');

    act(() => useExplorerStore.getState().setAutoPauseEnabled(true));
    expect(useExplorerStore.getState().autoPauseEnabled).toBe(true);
    expect(window.localStorage.getItem(AUTO_PAUSE_STORAGE_KEY)).toBe('1');
  });
});
