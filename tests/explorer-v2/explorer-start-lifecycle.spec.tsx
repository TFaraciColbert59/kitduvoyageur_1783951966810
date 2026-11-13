// @vitest-environment jsdom
import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown } from '@/features/explorer-v2/activity/Countdown';
import { useGpsTracker } from '@/features/explorer-v2/activity/useGpsTracker';
import { useExplorerStore, useTransientStart } from '@/features/explorer-v2/state/store';
import type { ActivityState, Sport, SportSelection } from '@/features/explorer-v2/state/types';
import { buildSheetModel, LiveDirectTab } from '@/features/explorer-v2/sheet/SheetContent';
import type { SheetContext } from '@/features/explorer-v2/sheet/context';
import {
  getSportFamily,
  getSportVariant,
  toSportSelection,
} from '@/features/explorer-v2/sheet/sportSelection';

const permissionsDescriptor = Object.getOwnPropertyDescriptor(navigator, 'permissions');

function selection(sport: Sport, variantId: string): SportSelection {
  const family = getSportFamily(sport);
  const variant = getSportVariant(variantId);
  if (!family || !variant) throw new Error(`variante absente: ${variantId}`);
  return toSportSelection(family, variant);
}

function context(): SheetContext {
  return {
    state: useExplorerStore.getState(),
    pois: [],
    units: 'metric',
  } as unknown as SheetContext;
}

function activity(): ActivityState {
  return {
    sport: 'rando',
    sessionId: null,
    startedAt: Date.now() - 60_000,
    paused: false,
    offRoute: false,
    distanceM: 1200,
    elevGainM: 80,
    movingS: 600,
  };
}

beforeEach(() => {
  useExplorerStore.setState({
    activity: undefined,
    summary: undefined,
    summarySaved: undefined,
    locationPermission: 'granted',
    scene: undefined,
    sheet: 'level',
    detent: 'peek',
    camera: { type: 'none' },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (permissionsDescriptor) Object.defineProperty(navigator, 'permissions', permissionsDescriptor);
  else delete (navigator as unknown as { permissions?: unknown }).permissions;
});

describe('explorer-v2 · brouillon de départ lié au montage', () => {
  it('conserve la variante jusqu’à l’activité', () => {
    const chosen = selection('rando', 'rando-refuge');
    const { result } = renderHook(() => useTransientStart());

    act(() => result.current.requestStart('rando', chosen));
    expect(result.current.pendingStart).toEqual({ sport: 'rando', selection: chosen });

    act(() => result.current.confirmStart());
    expect(result.current.pendingStart).toBeNull();
    expect(useExplorerStore.getState().activity?.sport).toBe('rando');
    expect(useExplorerStore.getState().activity?.selection).toEqual(chosen);
  });

  it('annule sans créer d’activité', () => {
    const { result } = renderHook(() => useTransientStart());
    act(() => result.current.requestStart('rando', selection('rando', 'rando-refuge')));
    act(() => result.current.cancelStart());
    expect(result.current.pendingStart).toBeNull();
    act(() => result.current.confirmStart());
    expect(useExplorerStore.getState().activity).toBeUndefined();
  });

  it('jette le brouillon au démontage : aucun départ autonome au retour', () => {
    const first = renderHook(() => useTransientStart());
    act(() => first.result.current.requestStart('rando', selection('rando', 'rando-refuge')));
    const confirmAfterUnmount = first.result.current.confirmStart;
    first.unmount();

    act(() => confirmAfterUnmount());
    expect(useExplorerStore.getState().activity).toBeUndefined();

    const second = renderHook(() => useTransientStart());
    expect(second.result.current.pendingStart).toBeNull();
    second.unmount();
  });
});

describe('explorer-v2 · compte à rebours', () => {
  it('déclenche onDone une seule fois, hors mise à jour d’état', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const errors: unknown[][] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });

    function Harness() {
      const [finished, setFinished] = React.useState(false);
      return (
        <>
          <span>{finished ? 'terminé' : 'en attente'}</span>
          <Countdown
            seconds={2}
            onDone={() => {
              setFinished(true);
              onDone();
            }}
          />
        </>
      );
    }

    render(<Harness />);
    act(() => vi.advanceTimersByTime(1999));
    expect(onDone).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('terminé')).toBeTruthy();
    expect(onDone).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(5000));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(errors.flat().join(' ')).not.toContain('Cannot update a component');
    errorSpy.mockRestore();
  });

  it('appelle onCancel sans attendre le décompte', () => {
    const onCancel = vi.fn();
    render(<Countdown seconds={3} onDone={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le départ' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('explorer-v2 · bilan local', () => {
  it('produit un bilan local en arrêtant une activité démarrée sans sessionId', () => {
    const chosen = selection('rando', 'rando-refuge');
    useExplorerStore.getState().startActivity('rando', null, chosen);
    useExplorerStore.getState().updateActivity({
      distanceM: 1200,
      elevGainM: 80,
      movingS: 600,
      offRoute: true,
    });

    const startedActivity = useExplorerStore.getState().activity;
    if (!startedActivity) throw new Error('activité locale absente après démarrage');
    expect(startedActivity.sessionId).toBeNull();
    expect(useExplorerStore.getState().summarySaved).toBeUndefined();

    act(() => useExplorerStore.getState().stopActivity());

    const stopped = useExplorerStore.getState();
    expect(stopped.activity).toBeUndefined();
    expect(stopped.summary).toEqual({
      ...startedActivity,
      distanceM: 1200,
      elevGainM: 80,
      movingS: 600,
      offRoute: true,
      endedAt: expect.any(Number),
    });
    expect(stopped.summarySaved).toBe('local');
    expect(stopped.sheet).toBe('summary');
    expect(stopped.detent).toBe('full');
    expect(stopped.camera).toEqual({ type: 'overview' });

    const model = buildSheetModel(context());
    render(<>{model.tabs[0].render()}</>);

    expect(screen.getByText('Sortie locale')).toBeTruthy();
    expect(
      screen.getByText('Cette séance n’a pas d’identité serveur ; elle n’est pas synchronisée.'),
    ).toBeTruthy();
    expect(screen.queryByText('Connecte-toi pour conserver tes sorties')).toBeNull();
  });

  it('n’affiche pas de conseil de connexion pour une séance sans UUID', () => {
    useExplorerStore.setState({
      summary: { ...activity(), endedAt: Date.now() },
      summarySaved: 'local',
      sheet: 'summary',
    });
    const model = buildSheetModel(context());
    render(<>{model.tabs[0].render()}</>);

    expect(screen.getByText('Sortie locale')).toBeTruthy();
    expect(
      screen.getByText('Cette séance n’a pas d’identité serveur ; elle n’est pas synchronisée.'),
    ).toBeTruthy();
    expect(screen.queryByText('Connecte-toi pour conserver tes sorties')).toBeNull();
  });

  it('garde le conseil de connexion pour une séance UUID non authentifiée', () => {
    useExplorerStore.setState({
      summary: {
        ...activity(),
        sessionId: '00000000-0000-4000-8000-000000000000',
        endedAt: Date.now(),
      },
      summarySaved: 'unauthenticated',
      sheet: 'summary',
    });
    const model = buildSheetModel(context());
    render(<>{model.tabs[0].render()}</>);

    expect(screen.getByText('Sortie non enregistrée')).toBeTruthy();
    expect(screen.getByText('Connecte-toi pour conserver tes sorties')).toBeTruthy();
  });

  it('distingue une séance déjà close sans résumé retrouvé', () => {
    useExplorerStore.setState({
      summary: {
        ...activity(),
        sessionId: '00000000-0000-4000-8000-000000000000',
        endedAt: Date.now(),
      },
      summarySaved: 'already_finished_without_summary',
      sheet: 'summary',
    });
    const model = buildSheetModel(context());
    render(<>{model.tabs[0].render()}</>);

    expect(screen.getByText('Sortie déjà close')).toBeTruthy();
    expect(
      screen.getByText('Aucun résumé n’a été retrouvé pour cette séance.'),
    ).toBeTruthy();
    // Ne jamais annoncer « aucun doublon » quand aucun résumé n'est connu.
    expect(screen.queryByText('Aucun doublon n’a été créé.')).toBeNull();
  });
});

describe('explorer-v2 · direct et permission réelle', () => {
  it('signale la pause automatique sans la confondre avec la pause manuelle', () => {
    useExplorerStore.getState().startActivity('rando');
    useExplorerStore.getState().updateActivity({ autoPaused: true });

    const automatic = render(<LiveDirectTab ctx={context()} />);
    expect(screen.getByText('Pause automatique')).toBeTruthy();
    expect(screen.queryByText('Pause manuelle')).toBeNull();
    automatic.unmount();

    useExplorerStore.getState().updateActivity({ paused: true, autoPaused: false });
    render(<LiveDirectTab ctx={context()} />);
    expect(screen.getByText('Pause manuelle')).toBeTruthy();
    expect(screen.queryByText('Pause automatique')).toBeNull();
  });

  it('affiche « Vitesse » et son unité pour Gravel, pas « Allure »', () => {
    const chosen = selection('velo', 'velo-gravel');
    useExplorerStore.getState().startActivity('velo', null, chosen);
    useExplorerStore.getState().updateActivity({ distanceM: 1200, movingS: 600 });
    render(<LiveDirectTab ctx={context()} />);

    expect(screen.getByText('Vitesse')).toBeTruthy();
    expect(screen.getByText('7,2 km/h')).toBeTruthy();
    expect(screen.queryByText('Allure')).toBeNull();
    expect(screen.queryByText(/\/km/)).toBeNull();
  });

  it('affiche une allure calculée pour Course, avec l’unité LKDV', () => {
    const chosen = selection('course', 'course-route');
    useExplorerStore.getState().startActivity('course', null, chosen);
    useExplorerStore.getState().updateActivity({ distanceM: 1200, movingS: 600 });
    render(<LiveDirectTab ctx={context()} />);

    expect(screen.getByText('Allure')).toBeTruthy();
    expect(screen.getByText('8\'20"/km')).toBeTruthy();
    expect(screen.queryByText('Vitesse')).toBeNull();
    expect(screen.queryByText(/km\/h/)).toBeNull();
  });

  it('affiche une allure calculée pour Trail, avec l’unité LKDV', () => {
    const chosen = selection('trail', 'trail-10k');
    useExplorerStore.getState().startActivity('trail', null, chosen);
    useExplorerStore.getState().updateActivity({ distanceM: 1000, movingS: 600 });
    render(<LiveDirectTab ctx={context()} />);

    expect(screen.getByText('Allure')).toBeTruthy();
    expect(screen.getByText('10\'00"/km')).toBeTruthy();
    expect(screen.queryByText('Vitesse')).toBeNull();
  });

  it('garde la vitesse préexistante pour les autres sports', () => {
    useExplorerStore.getState().startActivity('rando');
    useExplorerStore.getState().updateActivity({ distanceM: 1200, movingS: 600 });
    render(<LiveDirectTab ctx={context()} />);

    expect(screen.getByText('Vitesse')).toBeTruthy();
    expect(screen.getByText('7,2 km/h')).toBeTruthy();
    expect(screen.queryByText('Allure')).toBeNull();
  });

  it('ne montre aucune allure fictive quand le GPS est refusé', () => {
    const chosen = selection('course', 'course-route');
    useExplorerStore.getState().startActivity('course', null, chosen);
    useExplorerStore.getState().updateActivity({ distanceM: 1200, movingS: 600 });
    useExplorerStore.setState({ locationPermission: 'denied' });
    render(<LiveDirectTab ctx={context()} />);

    expect(screen.getByText('Allure')).toBeTruthy();
    expect(screen.queryByText('8\'20"/km')).toBeNull();
    expect(screen.queryByText(/km\/h/)).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('ne laisse pas croire que le GPS enregistre quand la position est refusée', () => {
    const chosen = selection('velo', 'velo-gravel');
    useExplorerStore.getState().startActivity('velo', null, chosen);
    useExplorerStore.setState({ locationPermission: 'denied' });
    render(<LiveDirectTab ctx={context()} />);

    expect(screen.getByText('Position refusée')).toBeTruthy();
    expect(
      screen.getByText('Aucun point GPS n’est enregistré. Autorise la position pour reprendre une trace.'),
    ).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('lit la permission réelle du navigateur', async () => {
    const query = vi.fn().mockResolvedValue({ state: 'denied', onchange: null });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query },
    });
    useExplorerStore.setState({ locationPermission: 'prompt' });

    const { unmount } = renderHook(() => useGpsTracker());
    await waitFor(() => expect(useExplorerStore.getState().locationPermission).toBe('denied'));
    expect(query).toHaveBeenCalledWith({ name: 'geolocation' });
    unmount();
  });
});
