import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const bridge = vi.hoisted(() => ({
  platform: 'ios',
  native: true,
  setRoute: vi.fn(async () => ({ active: true })),
  presentActions: vi.fn(async () => ({ active: true, actionId: 'save' as string | undefined })),
  share: vi.fn(async () => ({ active: true })),
  presentPrompt: vi.fn(async () => ({ active: true, value: 'Randonnée' as string | undefined })),
  presentDate: vi.fn(async () => ({ active: true, value: '2026-11-02' as string | undefined })),
  getCapabilities: vi.fn(async () => ({ available: true, dates: true })),  
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => bridge.platform,
    isNativePlatform: () => bridge.native,
  },
  registerPlugin: () => ({
    setRoute: bridge.setRoute,
    presentActions: bridge.presentActions,
    share: bridge.share,
    presentPrompt: bridge.presentPrompt,
    presentDate: bridge.presentDate,
    getCapabilities: bridge.getCapabilities,
  }),
}));

import {
  presentNativeActions,
  shareNativeURL,
  presentNativePrompt,
  presentNativeDate,
  hasNativeDatePicker,
  supportsNativeIOSUI,
  syncNativeUIRoute,
} from '@/lib/native/ui';

beforeEach(() => {
  bridge.platform = 'ios';
  bridge.native = true;
  bridge.setRoute.mockClear();
  bridge.presentActions.mockClear();
  bridge.share.mockClear();
  bridge.presentPrompt.mockReset().mockResolvedValue({ active: true, value: 'Randonnée' });
  bridge.presentDate.mockReset().mockResolvedValue({ active: true, value: '2026-11-02' });
  bridge.getCapabilities.mockReset().mockResolvedValue({ available: true, dates: true });
  bridge.setRoute.mockResolvedValue({ active: true });
  bridge.presentActions.mockResolvedValue({ active: true, actionId: 'save' });
  bridge.share.mockResolvedValue({ active: true });
  vi.stubGlobal('window', { location: { pathname: '/communaute' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LKDV native UI bridge', () => {
  it('only advertises iOS Capacitor support outside /compas', () => {
    expect(supportsNativeIOSUI()).toBe(true);
    expect(supportsNativeIOSUI('/compas')).toBe(false);
    expect(supportsNativeIOSUI('/compas/preparer')).toBe(false);
    bridge.platform = 'android';
    expect(supportsNativeIOSUI()).toBe(false);
    bridge.platform = 'ios';
    bridge.native = false;
    expect(supportsNativeIOSUI()).toBe(false);
  });

  it('lets the Next.js router remain authoritative, while telling native to close on Compas', async () => {
    expect(await syncNativeUIRoute('/communaute', 1)).toBe(true);
    expect(await syncNativeUIRoute('/compas', 2)).toBe(false);
    expect(bridge.setRoute).toHaveBeenCalledWith({ path: '/compas', revision: 2 });
  });

  it('returns selected action from a real native sheet', async () => {
    const selection = await presentNativeActions({
      title: 'Publication', actions: [{ id: 'save', title: 'Enregistrer' }],
    });
    expect(selection).toBe('save');
    expect(bridge.presentActions).toHaveBeenCalledTimes(1);
  });

  it('distinguishes native dismissal from unavailable plugin', async () => {
    bridge.presentActions.mockResolvedValueOnce({ active: true, actionId: undefined });
    expect(await presentNativeActions({
      title: 'Publication', actions: [{ id: 'hide', title: 'Masquer' }],
    })).toBeNull();
    bridge.presentActions.mockRejectedValueOnce(new Error('UNIMPLEMENTED'));
    expect(await presentNativeActions({
      title: 'Publication', actions: [{ id: 'hide', title: 'Masquer' }],
    })).toBeUndefined();
  });

  it('never invokes SwiftUI while Compas is the current page', async () => {
    vi.stubGlobal('window', { location: { pathname: '/compas' } });
    expect(await presentNativeActions({
      title: 'Publication', actions: [{ id: 'save', title: 'Enregistrer' }],
    })).toBeUndefined();
    expect(await shareNativeURL('https://lekitduvoyageur.fr/communaute')).toBe(false);
    expect(bridge.presentActions).not.toHaveBeenCalled();
    expect(bridge.share).not.toHaveBeenCalled();
  });

  it('refuses malformed actions and unsafe share URLs', async () => {
    expect(await presentNativeActions({ title: 'X', actions: [{ id: 'unsafe id', title: 'X' }] }))
      .toBeUndefined();
    expect(await shareNativeURL('javascript:alert(1)')).toBe(false);
    expect(await shareNativeURL('http://example.org')).toBe(false);
    expect(bridge.share).not.toHaveBeenCalled();
  });

  it('distinguishes native prompt input, cancellation and old iOS fallback', async () => {
    expect(await presentNativePrompt({ title: 'Nom du kit', defaultValue: '' })).toBe('Randonnée');
    bridge.presentPrompt.mockResolvedValueOnce({ active: true, value: undefined });
    expect(await presentNativePrompt({ title: 'Nom du kit' })).toBeNull();
    bridge.presentPrompt.mockRejectedValueOnce(new Error('UNIMPLEMENTED'));
    expect(await presentNativePrompt({ title: 'Nom du kit' })).toBeUndefined();
  });

  it('confirms native calendar availability before replacing the HTML date field', async () => {
    expect(await hasNativeDatePicker()).toBe(true);
    bridge.getCapabilities.mockRejectedValueOnce(new Error('unimplemented'));
    expect(await hasNativeDatePicker()).toBe(false);
  });

  it('returns a validated date, cancellation, or fallback from the native calendar', async () => {
    expect(await presentNativeDate('Départ', '2026-10-20')).toBe('2026-11-02');
    bridge.presentDate.mockResolvedValueOnce({ active: true, value: undefined });
    expect(await presentNativeDate('Départ')).toBeNull();
    bridge.presentDate.mockRejectedValueOnce(new Error('unimplemented'));
    expect(await presentNativeDate('Départ')).toBeUndefined();
    expect(await presentNativeDate('Départ', 'not-a-date')).toBeUndefined();
  });

  it('uses iOS system sharing for HTTPS and web fallback elsewhere', async () => {
    expect(await shareNativeURL('https://lekitduvoyageur.fr/communaute/post/123')).toBe(true);
    expect(bridge.share).toHaveBeenCalledWith({ url: 'https://lekitduvoyageur.fr/communaute/post/123' });
    bridge.platform = 'web';
    expect(await shareNativeURL('https://lekitduvoyageur.fr')).toBe(false);
  });
});
