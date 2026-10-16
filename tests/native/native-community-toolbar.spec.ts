// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  platform: 'ios',
  native: true,
  caps: vi.fn(async () => ({ available: true, toolbar: true })),
  setToolbar: vi.fn(async () => ({ active: true })),
  addListener: vi.fn(async (_event: string, _listener: (value: unknown) => void) => ({ remove: vi.fn(async () => {}) })),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => mock.platform, isNativePlatform: () => mock.native },
  registerPlugin: () => ({
    getCapabilities: mock.caps,
    setCommunityToolbar: mock.setToolbar,
    addListener: mock.addListener,
  }),
}));

import {
  hasNativeCommunityToolbar, setNativeCommunityToolbar, onNativeCommunityToolbarAction,
} from '@/lib/native/ui';

beforeEach(() => {
  mock.platform = 'ios';
  mock.native = true;
  mock.caps.mockReset().mockResolvedValue({ available: true, toolbar: true });
  mock.setToolbar.mockReset().mockResolvedValue({ active: true });
  mock.addListener.mockClear();
  vi.stubGlobal('window', { location: { pathname: '/communaute' } });
});
afterEach(() => vi.unstubAllGlobals());

describe('SwiftUI Community Liquid Glass toolbar', () => {
  it('advertises the toolbar only to iOS on the exact community route', async () => {
    expect(await hasNativeCommunityToolbar()).toBe(true);
    vi.stubGlobal('window', { location: { pathname: '/compas' } });
    expect(await hasNativeCommunityToolbar()).toBe(false);
    vi.stubGlobal('window', { location: { pathname: '/communaute/publier' } });
    expect(await hasNativeCommunityToolbar()).toBe(false);
    mock.platform = 'android';
    expect(await hasNativeCommunityToolbar()).toBe(false);
  });

  it('does not hide HTML controls until the native toolbar really activates', async () => {
    expect(await setNativeCommunityToolbar(true)).toBe(true);
    expect(mock.setToolbar).toHaveBeenCalledWith({ visible: true });
    mock.setToolbar.mockResolvedValueOnce({ active: false });
    expect(await setNativeCommunityToolbar(true)).toBe(false);
    mock.setToolbar.mockRejectedValueOnce(new Error('old shell'));
    expect(await setNativeCommunityToolbar(true)).toBe(false);
  });

  it('subscribes to action events without giving SwiftUI routing authority', async () => {
    const fn = vi.fn();
    const unsubscribe = await onNativeCommunityToolbarAction(fn);
    expect(mock.addListener).toHaveBeenCalledWith('communityToolbarAction', expect.any(Function));
    expect(typeof unsubscribe).toBe('function');
    expect(fn).not.toHaveBeenCalled();
    await unsubscribe?.();
  });

  it('can request toolbar removal even when Next.js has entered Compas', async () => {
    vi.stubGlobal('window', { location: { pathname: '/compas' } });
    expect(await setNativeCommunityToolbar(false)).toBe(true);
    expect(await setNativeCommunityToolbar(true)).toBe(false);
    expect(mock.setToolbar).toHaveBeenCalledTimes(1);
  });
});
