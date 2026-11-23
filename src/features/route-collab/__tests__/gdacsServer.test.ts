import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import fixture from '../analyse/__tests__/fixtures/gdacs-2026-11-23.json';
import { readWorldHazards, resetGdacsCacheForTests } from '../server/gdacsAlerts';

const NEAR = [{ lat: 15.5, lon: 80.4 }, { lat: 15.9, lon: 80.6 }];
const NOW = new Date('2026-11-02T12:00:00Z');
const okRes = () => new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } });

describe('GDACS côté serveur (7.6)', () => {
  beforeEach(() => resetGdacsCacheForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('lit le flux public sans clé, User-Agent de l’application, et le garde 5 minutes', async () => {
    const fetchMock = vi.fn(async () => okRes());
    vi.stubGlobal('fetch', fetchMock);
    const first = await readWorldHazards(NEAR, NOW);
    expect(first.status).toBe('alerts');
    await readWorldHazards(NEAR, NOW);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toMatch(/^https:\/\/www\.gdacs\.org\/gdacsapi\/api\/events\/geteventlist\/SEARCH\?eventlist=EQ;TC;FL;VO;WF&alertlevel=Orange;Red/);
    expect(url).not.toMatch(/key|token/i);
    expect(init.headers['User-Agent']).toBeTruthy();
  });

  it('panne réseau, erreur HTTP ou corps illisible : « indisponible », jamais « rien »', async () => {
    for (const reply of [() => Promise.reject(new Error('réseau')), () => Promise.resolve(new Response('{}', { status: 503 })), () => Promise.resolve(new Response('pas du json', { status: 200 }))]) {
      resetGdacsCacheForTests();
      vi.stubGlobal('fetch', vi.fn(reply));
      const r = await readWorldHazards(NEAR, NOW);
      expect(r.status).toBe('unavailable');
      expect(r.impacts).toEqual([]);
      expect(r.reason).toMatch(/GDACS/);
    }
  });

  it('après un échec, pas de nouvel appel avant une minute', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('réseau'); });
    vi.stubGlobal('fetch', fetchMock);
    await readWorldHazards(NEAR, NOW);
    await readWorldHazards(NEAR, NOW);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sans tracé : indisponible (rien n’est situé)', async () => {
    expect((await readWorldHazards([], NOW)).status).toBe('unavailable');
  });
});
