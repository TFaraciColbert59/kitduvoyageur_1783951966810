import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enrichCarnetElevation, resetCarnetElevationCache } from '../enrichElevation';
import type { CarnetDetail, ElevationPoint } from '../types';

/**
 * Profil altimétrique complété par le MNT d'Open-Meteo.
 *
 * Réseau simulé : aucun appel réel. Chaque cas vérifie une règle de la fiche —
 * altitude réelle seulement, aucune valeur inventée, aucune exception, un seul
 * aller-retour par heure et par tracé.
 */

/** Trace GeoJSON `LineString`, coordonnées réelles au format `[lng, lat]`. */
const lineString = (coordinates: Array<[number, number]>) => ({
  type: 'LineString',
  coordinates,
});

const THREE_POINTS: Array<[number, number]> = [
  [6.894707, 45.935757],
  [6.8958, 45.9365],
  [6.8971, 45.9372],
];

const detailWith = (overrides: Record<string, unknown> = {}): CarnetDetail =>
  ({
    id: '749e9e8c-9540-5a73-8b6c-6ab07264f62f',
    title: 'Carnet démo',
    trace: lineString(THREE_POINTS),
    elevationProfile: [],
    ...overrides,
  }) as unknown as CarnetDetail;

const elevationResponse = (elevation: unknown) =>
  new Response(JSON.stringify({ elevation }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

/** Une réponse neuve par appel : un corps de `Response` ne se lit qu'une fois. */
const answerWith = (elevation: unknown) =>
  fetchMock.mockImplementation(async () => elevationResponse(elevation));

const fetchMock = vi.fn();
const calledUrls = () => fetchMock.mock.calls.map((call) => String(call[0]));

beforeEach(() => {
  resetCarnetElevationCache();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetCarnetElevationCache();
});

describe('enrichCarnetElevation', () => {
  it('rend le profil des altitudes de l’API, distance cumulée sur la trace', async () => {
    answerWith([1200, 1300, 1250]);

    const detail = await enrichCarnetElevation(detailWith());
    const profile = detail.elevationProfile ?? [];

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(profile).toHaveLength(3);
    expect(profile.map((point) => point.elevationM)).toEqual([1200, 1300, 1250]);
    expect(profile[0].distanceKm).toBe(0);
    expect(profile[1].distanceKm).toBeGreaterThan(0);
    expect(profile[2].distanceKm).toBeGreaterThan(profile[1].distanceKm);
    // Coordonnées de la trace, jamais déplacées.
    expect(profile[0]).toMatchObject({ lat: 45.935757, lng: 6.894707 });
    expect(profile[2]).toMatchObject({ lat: 45.9372, lng: 6.8971 });
  });

  it('ne compte pas le saut entre deux morceaux dans la distance du profil', async () => {
    answerWith([1000, 1100, 1200, 1300]);
    const detail = await enrichCarnetElevation(
      detailWith({
        trace: {
          type: 'MultiLineString',
          coordinates: [
            [
              [6.8, 45.8],
              [6.81, 45.8],
            ],
            [
              [6.9, 45.9],
              [6.91, 45.9],
            ],
          ],
        },
      }),
    );
    const profile = detail.elevationProfile ?? [];

    expect(profile).toHaveLength(4);
    expect(profile[0].distanceKm).toBe(0);
    /* ~0,78 km par morceau : le saut de ~13 km ne doit pas apparaître. */
    expect(profile[1].distanceKm).toBeLessThan(1);
    expect(profile[3].distanceKm).toBeLessThan(2);
    /* Distance cumulée monotone : le second morceau repart de la fin du
       premier, sans revenir à zéro ni compter le vide qui les sépare. */
    const distances = profile.map((point) => point.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(profile[2].distanceKm).toBe(profile[1].distanceKm);
    expect(profile[3].distanceKm).toBeGreaterThan(profile[2].distanceKm);
    expect(profile.map((point) => point.segmentIndex)).toEqual([0, 0, 1, 1]);
    expect(profile[3].distanceKm).toBeLessThan(1.6);
  });

  it('demande les coordonnées de la trace au MNT, dans l’ordre', async () => {
    answerWith([1200, 1300, 1250]);

    await enrichCarnetElevation(detailWith());

    const url = new URL(calledUrls()[0]);
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.pathname).toBe('/v1/elevation');
    expect(url.searchParams.get('latitude')).toBe('45.935757,45.9365,45.9372');
    expect(url.searchParams.get('longitude')).toBe('6.894707,6.8958,6.8971');
    expect(url.searchParams.get('elevation')).toBeNull();
  });

  it('API en erreur : profil vide, fiche inchangée, aucune exception', async () => {
    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));

    await expect(enrichCarnetElevation(detailWith())).resolves.toBeTruthy();

    const detail = await enrichCarnetElevation(detailWith({ id: 'autre' }));
    expect(detail.elevationProfile).toEqual([]);
    expect(detail.trace).toEqual(lineString(THREE_POINTS));
  });

  it('moins de deux points : aucun appel réseau', async () => {
    expect((await enrichCarnetElevation(detailWith({ trace: lineString([]) }))).elevationProfile).toEqual(
      []
    );
    expect(
      (await enrichCarnetElevation(detailWith({ trace: lineString([[6.894707, 45.935757]]) })))
        .elevationProfile
    ).toEqual([]);
    expect((await enrichCarnetElevation(detailWith({ trace: null }))).elevationProfile).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deux appels identiques : un seul aller-retour', async () => {
    answerWith([1200, 1300, 1250]);

    const first = await enrichCarnetElevation(detailWith());
    const second = await enrichCarnetElevation(detailWith());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.elevationProfile).toEqual(second.elevationProfile);
    expect(second.elevationProfile).toHaveLength(3);
  });

  it('deux appels simultanés : un seul aller-retour', async () => {
    fetchMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(elevationResponse([1, 2, 3])), 5))
    );

    const [first, second] = await Promise.all([
      enrichCarnetElevation(detailWith()),
      enrichCarnetElevation(detailWith()),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.elevationProfile).toHaveLength(3);
    expect(second.elevationProfile).toHaveLength(3);
  });

  it('le cache expire après une heure', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-08T12:00:00Z') });
    answerWith([1200, 1300, 1250]);

    await enrichCarnetElevation(detailWith());
    await enrichCarnetElevation(detailWith());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-11-08T13:00:01Z'));
    const refreshed = await enrichCarnetElevation(detailWith());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Le second aller-retour porte bien un profil : il a été relu, pas esquivé.
    expect(refreshed.elevationProfile).toHaveLength(3);
  });

  it('profil déjà présent : rien à demander', async () => {
    const existing: ElevationPoint[] = [
      { distanceKm: 0, elevationM: 1000, lat: 45.9, lng: 6.9 },
      { distanceKm: 1.2, elevationM: 1180, lat: 45.91, lng: 6.91 },
    ];
    const detail = detailWith({ elevationProfile: existing });

    expect(await enrichCarnetElevation(detail)).toBe(detail);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('réponse qui ne couvre pas les points demandés : profil refusé', async () => {
    answerWith([1200, 1300]);

    expect((await enrichCarnetElevation(detailWith())).elevationProfile).toEqual([]);
  });

  it('altitude nulle ou non numérique : profil refusé, pas d’altitude inventée', async () => {
    answerWith([1200, null, 1250]);
    expect((await enrichCarnetElevation(detailWith())).elevationProfile).toEqual([]);

    resetCarnetElevationCache();
    answerWith([1200, '1300', 1250]);
    expect((await enrichCarnetElevation(detailWith())).elevationProfile).toEqual([]);

    resetCarnetElevationCache();
    fetchMock.mockImplementation(async () => new Response('pas du JSON', { status: 200 }));
    expect((await enrichCarnetElevation(detailWith())).elevationProfile).toEqual([]);
  });

  it('panne réseau : fiche inchangée', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const detail = await enrichCarnetElevation(detailWith());
    expect(detail.elevationProfile).toEqual([]);
    expect(detail.id).toBe('749e9e8c-9540-5a73-8b6c-6ab07264f62f');
  });

  it('au-delà de 3 s : requête abandonnée, profil vide', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          );
        })
    );

    const pending = enrichCarnetElevation(detailWith());
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    const detail = await pending;

    expect(detail.elevationProfile).toEqual([]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
  });

  it('échantillonne à 100 points au plus, extrémités gardées', async () => {
    const coordinates = Array.from(
      { length: 150 },
      (_, index) => [6.9 + index * 0.001, 45.9 + index * 0.0001] as [number, number]
    );
    answerWith(Array.from({ length: 100 }, (_, index) => 1000 + index));

    const detail = await enrichCarnetElevation(detailWith({ trace: lineString(coordinates) }));
    const latitudes = String(new URL(calledUrls()[0]).searchParams.get('latitude')).split(',');
    const profile = detail.elevationProfile ?? [];

    expect(latitudes).toHaveLength(100);
    expect(Number(latitudes[0])).toBe(45.9);
    expect(Number(latitudes[99])).toBe(coordinates[149][1]);
    expect(profile).toHaveLength(100);
    expect(profile[0].elevationM).toBe(1000);
    expect(profile[99].elevationM).toBe(1099);
  });
});
