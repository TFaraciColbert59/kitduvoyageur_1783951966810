import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/geodata', () => ({ fetchCountryByIso: vi.fn(), fetchPlacesByCountry: vi.fn() }));
vi.mock('@/lib/queries/trails', () => ({ getTrails: vi.fn() }));

import { fetchCountryByIso, fetchPlacesByCountry } from '@/lib/geodata';
import { getTrails } from '@/lib/queries/trails';
import { GET } from '@/app/api/pays/[code]/trails/route';

const geoMock = vi.mocked(fetchCountryByIso);
const placesMock = vi.mocked(fetchPlacesByCountry);
const trailsMock = vi.mocked(getTrails);
const params = (code: string) => ({ params: Promise.resolve({ code }) });

const polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-18, 64],
      [-17, 64],
      [-17, 65],
      [-18, 65],
      [-18, 64],
    ],
  ],
};

describe('GET /api/pays/[code]/trails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    geoMock.mockResolvedValue({ geometry: polygon } as never);
    placesMock.mockResolvedValue([] as never);
    trailsMock.mockResolvedValue([
      {
        id: 't1',
        name: 'Laugavegur',
        lat: 64,
        lng: -19,
        distance_km: 55,
        duration_hours: null,
        difficulty: 'Difficile',
        elevation_gain: 1200,
      },
    ] as never);
  });

  it('refuse un code invalide', async () => {
    const res = await GET(new Request('http://localhost'), params('X'));
    expect(res.status).toBe(400);
  });

  it('renvoie les sentiers réels du pays (bbox)', async () => {
    const res = await GET(new Request('http://localhost'), params('IS'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.items[0].name).toBe('Laugavegur');
    expect(trailsMock).toHaveBeenCalledWith(
      expect.objectContaining({ minLat: 64, maxLat: 65, minLng: -18, maxLng: -17, limit: 6 })
    );
  });

  it('dérive la bbox des villes quand la géométrie est absente', async () => {
    geoMock.mockResolvedValue({ geometry: null } as never);
    placesMock.mockResolvedValue([
      { latitude: 50.8, longitude: 4.3 },
      { latitude: 51.2, longitude: 4.9 },
    ] as never);

    const res = await GET(new Request('http://localhost'), params('BE'));
    expect(res.status).toBe(200);
    expect(trailsMock).toHaveBeenCalledWith(
      expect.objectContaining({ minLat: 50.8, maxLat: 51.2, minLng: 4.3, maxLng: 4.9 })
    );
  });

  it('état vide sans géométrie ni villes géolocalisées', async () => {
    geoMock.mockResolvedValue({ geometry: null } as never);
    placesMock.mockResolvedValue([] as never);
    const res = await GET(new Request('http://localhost'), params('FR'));
    expect((await res.json()).status).toBe('empty');
    expect(trailsMock).not.toHaveBeenCalled();
  });

  it('404 pays inconnu + 502 erreur référentiel', async () => {
    geoMock.mockResolvedValue(null as never);
    expect((await GET(new Request('http://localhost'), params('ZZ'))).status).toBe(404);

    geoMock.mockRejectedValue(new Error('db'));
    expect((await GET(new Request('http://localhost'), params('JP'))).status).toBe(502);
  });
});
