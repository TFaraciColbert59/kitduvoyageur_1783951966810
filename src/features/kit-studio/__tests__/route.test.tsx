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
vi.mock('../services/kitRepository', () => ({ load: async () => null, save: async () => {} }));

import { statusBarThemeForPath } from '@/lib/native/status-bar';
import { KitStudioClient } from '../ui/KitStudioClient';
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
    render(<KitStudioClient />);
    expect(screen.getByTestId('scene')).toBeTruthy();
    expect(dock().getAttribute('data-open')).toBe('false');
  });

  it('ouvre le tiroir à 750 ms si rien n’a été fait', () => {
    render(<KitStudioClient />);
    act(() => void vi.advanceTimersByTime(749));
    expect(dock().getAttribute('data-open')).toBe('false');
    act(() => void vi.advanceTimersByTime(2));
    expect(dock().getAttribute('data-open')).toBe('true');
  });

  it('l’ouverture automatique ne remplace pas une ouverture manuelle faite avant 750 ms', () => {
    render(<KitStudioClient />);
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

  it('Échap ferme d’abord la vue, puis le tiroir', () => {
    render(<KitStudioClient />);
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
});

describe('barre d’état', () => {
  it('/kit-studio prend le thème clair, comme /compas', () => {
    expect(statusBarThemeForPath('/kit-studio')).toBe('compas');
    expect(statusBarThemeForPath('/kit-studio/')).toBe('compas');
    expect(statusBarThemeForPath('/kit-studiox')).toBe('default');
    expect(statusBarThemeForPath('/hub')).toBe('default');
  });
});
