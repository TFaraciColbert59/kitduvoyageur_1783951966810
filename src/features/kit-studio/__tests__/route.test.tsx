// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

const sceneCalls = vi.hoisted(() => ({ created: 0, disposed: 0, drawer: [] as boolean[] }));

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockScene() {
      return <canvas data-testid="scene" />;
    },
}));
vi.mock('../scene/createScene', () => ({
  createKitScene: () => {
    sceneCalls.created += 1;
    return {
      update: () => {},
      setDrawerOpen: (o: boolean) => sceneCalls.drawer.push(o),
      resize: () => {},
      dispose: () => {
        sceneCalls.disposed += 1;
      },
      info: () => ({}),
    };
  },
}));
vi.mock('@/hooks/useHapticFeedback', () => ({ useHapticFeedback: () => ({ haptic: vi.fn() }) }));
const repoMock = vi.hoisted(() => ({ load: vi.fn(async () => null as unknown), save: vi.fn(async () => {}) }));
vi.mock('../services/kitRepository', () => ({ load: repoMock.load, save: repoMock.save }));

import { statusBarThemeForPath } from '@/lib/native/status-bar';
import { COLORWAYS, DEFAULT_CONFIG, FAMILIES, ITEMS, KITS, ONE } from '../domain/catalog';
import type { StudioData } from '../domain/studioData';
import { createInitialState } from '../domain/state';
import { KitStudioClient } from '../ui/KitStudioClient';
import { useKitStore } from '../store/kitStore';
import { useUiStore } from '../store/uiStore';

const dock = () => screen.getByRole('dialog', { hidden: true });

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState({ dockOpen: false, view: 'cards', sheet: null, pendingOpen: null });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('KitStudioClient', () => {
  it('monte sans erreur avec la scène mockée', () => {
    render(<KitStudioClient mode="debug" />);
    expect(screen.getByTestId('scene')).toBeTruthy();
    expect(dock().getAttribute('data-open')).toBe('false');
  });

  it('ouvre le tiroir à 750 ms si rien n’a été fait', () => {
    render(<KitStudioClient mode="debug" />);
    act(() => void vi.advanceTimersByTime(749));
    expect(dock().getAttribute('data-open')).toBe('false');
    act(() => void vi.advanceTimersByTime(2));
    expect(dock().getAttribute('data-open')).toBe('true');
  });

  it('l’ouverture automatique ne remplace pas une ouverture manuelle faite avant 750 ms', () => {
    render(<KitStudioClient mode="debug" />);
    act(() => {
      vi.advanceTimersByTime(300);
      useUiStore.getState().openSheet('order');
      useUiStore.getState().setView('sheet');
      useUiStore.getState().setDockOpen(true);
    });
    act(() => void vi.advanceTimersByTime(1000));
    const ui = useUiStore.getState();
    expect(ui.dockOpen).toBe(true);
    expect(ui.view).toBe('sheet');
    expect(ui.sheet?.kind).toBe('order');
  });

  it('en production, aucun rendu de démonstration avant l’hydratation réelle', () => {
    // Chargement local volontairement suspendu : l'écran doit rester un shell vide, jamais
    // le jeu de démonstration (exigence P1 : pas de factice sur le chemin de production).
    repoMock.load.mockImplementationOnce(() => new Promise(() => {}));
    useKitStore.setState({ hydrated: false, kit: createInitialState() });
    const data: StudioData = {
      items: ITEMS,
      kits: KITS,
      one: ONE,
      colorways: COLORWAYS,
      config: DEFAULT_CONFIG,
      own: {},
      order: {},
      bodyKg: 72,
      families: FAMILIES,
    };
    render(<KitStudioClient mode="server" initialData={data} />);
    expect(screen.queryByTestId('scene')).toBeNull();
    expect(screen.queryByText(/données fictives/i)).toBeNull();
    expect(document.querySelector('[data-mode="server"][aria-busy="true"]')).not.toBeNull();
  });

  it('Échap ferme d’abord la vue, puis le tiroir', () => {
    render(<KitStudioClient mode="debug" />);
    act(() => {
      useUiStore.getState().openSheet('bilan');
      useUiStore.getState().setView('sheet');
      useUiStore.getState().setDockOpen(true);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(useUiStore.getState().view).toBe('cards');
    expect(useUiStore.getState().sheet).toBeNull();
    expect(useUiStore.getState().dockOpen).toBe(true);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(useUiStore.getState().dockOpen).toBe(false);
  });

  it('masque la bottom bar au montage et la rétablit au démontage', () => {
    const events: boolean[] = [];
    const handler = (e: Event) => {
      events.push((e as CustomEvent<{ hide?: boolean }>).detail?.hide ?? false);
    };
    window.addEventListener('lkdv-toggle-bottom-bar', handler);

    const { unmount } = render(<KitStudioClient mode="debug" />);
    expect(document.documentElement.getAttribute('data-kit-studio-open')).toBe('true');
    expect(document.body.getAttribute('data-kit-studio-open')).toBe('true');
    expect(events).toContain(true);

    unmount();
    expect(document.documentElement.getAttribute('data-kit-studio-open')).toBeNull();
    expect(document.body.getAttribute('data-kit-studio-open')).toBeNull();
    expect(events[events.length - 1]).toBe(false);

    window.removeEventListener('lkdv-toggle-bottom-bar', handler);
  });

  it('un geste de glissement vers la droite déclenche onExit', () => {
    const onExit = vi.fn();
    render(<KitStudioClient mode="debug" onExit={onExit} />);

    // Touchstart à gauche
    window.dispatchEvent(
      new TouchEvent('touchstart', {
        touches: [{ clientX: 40, clientY: 100 } as Touch],
      })
    );

    // Touchend vers la droite (dx = 120px)
    window.dispatchEvent(
      new TouchEvent('touchend', {
        changedTouches: [{ clientX: 160, clientY: 105 } as Touch],
      })
    );

    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('barre d’état', () => {
  it('/kit-studio prend le thème clair, comme /compas', () => {
    expect(statusBarThemeForPath('/kit-studio')).toBe('compas');
    expect(statusBarThemeForPath('/kit-studio/')).toBe('compas');
    expect(statusBarThemeForPath('/kit-studiox')).toBe('default');
    expect(statusBarThemeForPath('/hub')).toBe('default');
  });
});
