import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// Sans base : le cache partagé reste en mémoire de l'instance.
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: () => null }));

import { commonsTuning, lookupCommonsPhoto } from '../server/commons';

/** Un lieu par test : le cache mémoire de l'instance garde ce qu'on lui donne. */
let n = 0;
const point = () => ({ lat: 44 + ++n * 0.01, lon: 5.4 });

const apiPhoto = (p: { lat: number; lon: number }) => ({
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 1,
        ns: 6,
        title: 'File:Vue du Vercors.jpg',
        index: 1,
        coordinates: [{ lat: p.lat + 0.0005, lon: p.lon, primary: true, globe: 'earth' }],
        imageinfo: [
          {
            width: 3000,
            height: 2000,
            mime: 'image/jpeg',
            thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Vue_du_Vercors.jpg/480px-Vue_du_Vercors.jpg',
            descriptionurl: 'https://commons.wikimedia.org/wiki/File:Vue_du_Vercors.jpg',
            extmetadata: {
              Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:M">Marie Martin</a>' },
              LicenseShortName: { value: 'CC BY-SA 4.0' },
              License: { value: 'cc-by-sa-4.0' },
            },
          },
        ],
      },
    ],
  },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('lookupCommonsPhoto', () => {
  beforeEach(() => {
    commonsTuning.gapMs = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('demande Commons une fois, avec un User-Agent qui nomme l’application, puis sert le cache', async () => {
    const p = point();
    const fetchMock = vi.fn(async () => json(apiPhoto(p)));
    vi.stubGlobal('fetch', fetchMock);

    const first = await lookupCommonsPhoto(p, { allowNetwork: true });
    expect(first.state).toBe('fetched');
    expect(first.photo).toMatchObject({ credit: 'Marie Martin', license: 'CC BY-SA 4.0' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('https://commons.wikimedia.org/w/api.php?');
    expect(url).toContain('generator=geosearch');
    const ua = (init.headers as Record<string, string>)['User-Agent'];
    expect(ua).toMatch(/^kitduvoyageur\/1\.0 \(.*\+https:\/\/.+\)$/);

    const second = await lookupCommonsPhoto(p, { allowNetwork: true });
    expect(second).toEqual({ state: 'cached', photo: first.photo });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un point voisin (même clé à 3 décimales) partage la réponse', async () => {
    const p = point();
    const fetchMock = vi.fn(async () => json(apiPhoto(p)));
    vi.stubGlobal('fetch', fetchMock);
    await lookupCommonsPhoto(p, { allowNetwork: true });
    const near = await lookupCommonsPhoto({ lat: p.lat + 0.0002, lon: p.lon - 0.0002 }, { allowNetwork: true });
    expect(near.state).toBe('cached');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sans réseau permis et sans cache : « on ne sait pas », aucune requête', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await lookupCommonsPhoto(point(), { allowNetwork: false })).toEqual({ state: 'skipped', photo: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aucune photo acceptable : null, gardé (pas de nouvelle requête)', async () => {
    const p = point();
    const fetchMock = vi.fn(async () => json({ batchcomplete: true }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await lookupCommonsPhoto(p, { allowNetwork: true })).toEqual({ state: 'fetched', photo: null });
    expect(await lookupCommonsPhoto(p, { allowNetwork: true })).toEqual({ state: 'cached', photo: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('une licence refusée donne « pas de photo », jamais une photo sous licence non libre', async () => {
    const p = point();
    const body = apiPhoto(p);
    body.query.pages[0].imageinfo[0].extmetadata.LicenseShortName.value = 'CC BY-NC 4.0';
    vi.stubGlobal('fetch', vi.fn(async () => json(body)));
    expect(await lookupCommonsPhoto(p, { allowNetwork: true })).toEqual({ state: 'fetched', photo: null });
  });

  it('une panne n’est jamais gardée : l’appel suivant redemande', async () => {
    const p = point();
    const fetchMock = vi.fn(async () => {
      throw new Error('connexion refusée');
    });
    vi.stubGlobal('fetch', fetchMock);
    // Reprise unique (attente courte) puis abandon.
    expect(await lookupCommonsPhoto(p, { allowNetwork: true })).toEqual({ state: 'failed', photo: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockImplementation(async () => json(apiPhoto(p)) as never);
    expect((await lookupCommonsPhoto(p, { allowNetwork: true })).state).toBe('fetched');
  });

  it('429 puis réponse : une reprise suffit', async () => {
    const p = point();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('slow down', { status: 429 }))
      .mockResolvedValueOnce(json(apiPhoto(p)));
    vi.stubGlobal('fetch', fetchMock);
    const r = await lookupCommonsPhoto(p, { allowNetwork: true });
    expect(r.state).toBe('fetched');
    expect(r.photo).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('erreur 404 : pas de reprise, panne', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await lookupCommonsPhoto(point(), { allowNetwork: true })).state).toBe('failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('erreur d’API rendue avec un statut 200 : panne, pas « aucune photo »', async () => {
    const p = point();
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'ratelimited', info: 'Trop vite' } })));
    expect((await lookupCommonsPhoto(p, { allowNetwork: true })).state).toBe('failed');
    expect((await lookupCommonsPhoto(p, { allowNetwork: false })).state).toBe('skipped');
  });

  it('échéance dépassée : aucune requête, panne', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await lookupCommonsPhoto(point(), { allowNetwork: true, deadline: Date.now() + 100 });
    expect(r.state).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('les requêtes partent l’une après l’autre, jamais en parallèle', async () => {
    let running = 0;
    let peak = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        return json({ batchcomplete: true });
      })
    );
    await Promise.all([point(), point(), point()].map((p) => lookupCommonsPhoto(p, { allowNetwork: true })));
    expect(peak).toBe(1);
  });

  it('coordonnées invalides : ignorées', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await lookupCommonsPhoto({ lat: Number.NaN, lon: 5 }, { allowNetwork: true })).toEqual({ state: 'skipped', photo: null });
    expect(await lookupCommonsPhoto({ lat: 95, lon: 5 }, { allowNetwork: true })).toEqual({ state: 'skipped', photo: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
