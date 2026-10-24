// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

/**
 * Plan 5.4 : la barre d'état suit la route. Le démarrage natif (NativeAppBootstrap)
 * pose le thème du Compas à l'arrivée directe, à l'entrée, et rend celui de l'app
 * en le quittant. Les modules natifs sont moqués à la frontière : on vérifie la
 * décision (quel thème, quand), pas le rendu de la barre.
 */

const state = vi.hoisted(() => ({ pathname: '/hub' }));
const applyStatusBarTheme = vi.hoisted(() => vi.fn(async (_theme: string) => {}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ refetchQueries: vi.fn(async () => {}) }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, refreshProfile: vi.fn(async () => {}) }),
}));
vi.mock('@/components/ReactQueryProvider', () => ({ useCriticalCacheReady: () => true }));
vi.mock('@/lib/storage/cacheDB', () => ({ purgeExpiredCache: vi.fn(async () => {}) }));
vi.mock('@/lib/native', async () => {
  const real = await vi.importActual<typeof import('@/lib/native/status-bar')>('@/lib/native/status-bar');
  return {
    isNative: () => true,
    hideNativeSplashScreen: vi.fn(async () => {}),
    setupNativeAppListeners: vi.fn(async () => () => {}),
    statusBarThemeForPath: real.statusBarThemeForPath,
    applyStatusBarTheme,
  };
});

import NativeAppBootstrap from '@/components/NativeAppBootstrap';

beforeEach(() => {
  cleanup();
  applyStatusBarTheme.mockClear();
  state.pathname = '/hub';
});

describe('barre d’état au démarrage natif', () => {
  it('hors Compas : le thème de l’app', () => {
    render(<NativeAppBootstrap />);
    expect(applyStatusBarTheme.mock.calls).toEqual([['default']]);
  });

  it('arrivée directe sur le Compas : texte sombre dès le premier rendu', () => {
    state.pathname = '/compas';
    render(<NativeAppBootstrap />);
    expect(applyStatusBarTheme.mock.calls).toEqual([['compas']]);
  });

  it('entrée puis sortie du Compas : thème du Compas, puis thème de l’app', () => {
    const { rerender } = render(<NativeAppBootstrap />);
    state.pathname = '/compas';
    rerender(<NativeAppBootstrap />);
    state.pathname = '/hub';
    rerender(<NativeAppBootstrap />);
    expect(applyStatusBarTheme.mock.calls.map((c) => c[0])).toEqual(['default', 'compas', 'default']);
  });

  it('rester sur le Compas (changement d’étape, d’onglet) ne repeint pas la barre', () => {
    state.pathname = '/compas';
    const { rerender } = render(<NativeAppBootstrap />);
    rerender(<NativeAppBootstrap />);
    rerender(<NativeAppBootstrap />);
    expect(applyStatusBarTheme).toHaveBeenCalledTimes(1);
  });
});
