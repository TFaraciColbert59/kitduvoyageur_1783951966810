// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRouteViewModeSyncForTests, setRouteViewMode, syncRouteViewModeFromAccount } from '../components/workspace/expertMode';

const KEY = 'lkdv:itineraire:viewMode:v1';
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('Simple / Expert par compte (4.1)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetRouteViewModeSyncForTests();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('la valeur du compte l’emporte sur le réglage local', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(200, { routeViewMode: 'expert' })));
    await syncRouteViewModeFromAccount();
    expect(window.localStorage.getItem(KEY)).toBe('expert');
  });

  it('sans compte (401) ou en panne réseau, le réglage local reste', async () => {
    window.localStorage.setItem(KEY, 'expert');
    vi.stubGlobal('fetch', vi.fn(async () => reply(401, {})));
    await syncRouteViewModeFromAccount();
    expect(window.localStorage.getItem(KEY)).toBe('expert');
    resetRouteViewModeSyncForTests();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('hors ligne'); }));
    await syncRouteViewModeFromAccount();
    expect(window.localStorage.getItem(KEY)).toBe('expert');
  });

  it('sans valeur au compte, le réglage local expert y est reporté une fois', async () => {
    window.localStorage.setItem(KEY, 'expert');
    const fetchMock = vi.fn(async (_u: string, init?: { method?: string }) => (init?.method === 'PUT' ? reply(200, {}) : reply(200, { routeViewMode: null })));
    vi.stubGlobal('fetch', fetchMock);
    await syncRouteViewModeFromAccount();
    await syncRouteViewModeFromAccount();
    const puts = fetchMock.mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(JSON.parse((puts[0][1] as { body: string }).body)).toEqual({ routeViewMode: 'expert' });
  });

  it('la bascule écrit en local puis au compte ; l’échec du compte ne la défait pas', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('hors ligne'); });
    vi.stubGlobal('fetch', fetchMock);
    setRouteViewMode('expert');
    expect(window.localStorage.getItem(KEY)).toBe('expert');
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith('/api/itineraire/prefs', expect.objectContaining({ method: 'PUT' }));
    expect(window.localStorage.getItem(KEY)).toBe('expert');
  });
});
