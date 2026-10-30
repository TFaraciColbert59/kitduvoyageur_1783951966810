// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';

const bridge = vi.hoisted(() => ({
  pathname: '/explorer', lastRevision: -1, visible: false, selectedId: null as string | null,
  requests: [] as { visible: boolean; revision: number; selectedId?: string | null }[],
  deferNext: false, resolvePending: null as (() => void) | null,
  push: vi.fn(), prefetch: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
  registerPlugin: () => ({
    setVisible: async (request: { visible: boolean; revision: number; selectedId?: string | null }) => {
      bridge.requests.push(request);
      // Same ordering contract as SceneDelegate.setVisible: lower revisions lose.
      if (request.revision >= bridge.lastRevision) {
        bridge.lastRevision = request.revision;
        bridge.visible = request.visible;
        bridge.selectedId = request.selectedId ?? null;
      }
      const result = { active: bridge.visible, height: bridge.deferNext ? 41 : 83 };
      if (bridge.deferNext) {
        bridge.deferNext = false;
        await new Promise<void>((resolve) => { bridge.resolvePending = resolve; });
      }
      return result;
    },
    addListener: async () => ({ remove: vi.fn() }),
  }),
}));
vi.mock('next/navigation', () => ({ usePathname: () => bridge.pathname, useRouter: () => bridge }));
vi.mock('next/dynamic', () => ({ default: () => NavigationBar }));
vi.mock('@/contexts/SearchContext', () => ({ useSearchContext: () => ({}) }));
vi.mock('../OfflineBanner', () => ({ default: () => null }));
vi.mock('@/components/search/SearchOverlay', () => ({ default: () => null }));
vi.mock('../navigation/NavigationSurface', () => ({ default: () => null }));
vi.mock('../navigation/WebNavigationBar', () => ({ default: () => null }));
vi.mock('../FloatingLiquidTabBar', () => ({ default: () => <div data-testid="web-fallback" /> }));
vi.mock('../navigation/NavigationPlateau', () => ({ default: () => null }));
vi.mock('../navigation/DayPlateau', () => ({ default: () => null }));
vi.mock('../navigation/useNavigationPlateau', () => ({ useNavigationPlateau: () => ({ hiddenByEvent: false }) }));
vi.mock('../dayFocusStore', () => ({ useDayFocusStore: () => [], hasDayFocusPlateau: () => false }));
vi.mock('@/lib/native/network', () => ({ getNetworkState: async () => ({ connected: false }) }));

import NavigationBar from '../NavigationBar';
import MobileNavWrapper from '../MobileNavWrapper';

afterEach(cleanup);

describe('native bridge lifecycle (OPS-NATIVE-01)', () => {
  it('restores the bridge after React strict mode effect cleanup', async () => {
    bridge.pathname = '/explorer';
    render(<StrictMode><MobileNavWrapper /></StrictMode>);
    await waitFor(() => expect(bridge.visible).toBe(true));
    await waitFor(() => expect(document.documentElement.getAttribute('data-native-glass-nav')).toBe('explorer'));
  });

  it('does not let an older component cleanup hide a newer owner', async () => {
    bridge.pathname = '/explorer';
    const oldView = render(<NavigationBar />);
    await waitFor(() => expect(bridge.visible).toBe(true));
    bridge.pathname = '/compte';
    render(<NavigationBar />);
    await waitFor(() => expect(bridge.selectedId).toBe('me'));
    oldView.unmount();
    expect(bridge.visible).toBe(true);
    expect(document.documentElement.getAttribute('data-native-glass-nav')).toBe('me');
  });

  it('ignores a delayed result from an older mounted owner', async () => {
    bridge.pathname = '/explorer';
    bridge.deferNext = true;
    render(<NavigationBar />);
    render(<NavigationBar />);
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--lkv-native-bar-height')).toBe('83px'));
    await act(async () => bridge.resolvePending?.());
    expect(document.documentElement.style.getPropertyValue('--lkv-native-bar-height')).toBe('83px');
  });

  it.each(['/connexion', '/inscription', '/checkout', '/communaute/reels', '/carte-3d'])('restores native tabs immediately after returning from %s', async (excluded) => {
    bridge.pathname = '/explorer';
    const view = render(<MobileNavWrapper />);
    await waitFor(() => expect(bridge.visible).toBe(true));
    for (const path of ['/compte', '/explorer', '/compte']) {
      bridge.pathname = path;
      await act(async () => view.rerender(<MobileNavWrapper />));
    }
    bridge.pathname = excluded;
    await act(async () => view.rerender(<MobileNavWrapper />));
    expect(bridge.visible).toBe(false);
    const cleanupRevision = bridge.lastRevision;
    bridge.pathname = '/explorer';
    await act(async () => view.rerender(<MobileNavWrapper />));
    expect(bridge.requests.at(-1)?.revision).toBeGreaterThan(cleanupRevision);
    expect(bridge.visible).toBe(true);
    expect(bridge.selectedId).toBe('explorer');
    expect(view.queryByTestId('web-fallback')).toBeNull();
  });
});
