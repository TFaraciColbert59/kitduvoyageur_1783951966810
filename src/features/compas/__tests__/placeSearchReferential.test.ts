import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompasPlace } from '../engine/places';

/**
 * `resolvePlaceByName` (destination, départ, domicile) : le référentiel `geo_places` d'abord
 * (plan 1.3), la carte ensuite exactement comme avant quand il ne répond rien de sûr.
 */
vi.mock('server-only', () => ({}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn() }));
const referentialPlaceSearch = vi.fn();
vi.mock('../server/geoPlaces', () => ({
  referentialPlaceSearch: (...a: unknown[]) => referentialPlaceSearch(...a),
}));
const lookupDestination = vi.fn();
const lookupNatural = vi.fn();
const lookupLoose = vi.fn();
vi.mock('../server/placeLookup', () => ({
  lookupDestination: (...a: unknown[]) => lookupDestination(...a),
  lookupNatural: (...a: unknown[]) => lookupNatural(...a),
  lookupLoose: (...a: unknown[]) => lookupLoose(...a),
}));

import { resolvePlaceByName } from '../server/placeSearch';

const place = (name: string, extra: Partial<CompasPlace> = {}): CompasPlace => ({
  name,
  lat: 45,
  lon: 5.5,
  countryCode: 'FR',
  country: 'France',
  kind: 'village',
  extent: null,
  ...extra,
});

beforeEach(() => {
  referentialPlaceSearch.mockReset().mockResolvedValue(null);
  lookupDestination.mockReset().mockResolvedValue(null);
  lookupNatural.mockReset().mockResolvedValue(null);
  lookupLoose.mockReset().mockResolvedValue(null);
});

describe('resolvePlaceByName : référentiel d’abord', () => {
  it('le référentiel trouve : ni carte, ni spécialiste', async () => {
    const villard = place('Villard-de-Lans', { settlement: true, settlementRank: 3 });
    referentialPlaceSearch.mockResolvedValue(villard);
    const specialist = vi.fn();
    expect(await resolvePlaceByName('Villard de Lans', specialist)).toEqual(villard);
    expect(referentialPlaceSearch).toHaveBeenCalledWith('Villard de Lans');
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(specialist).not.toHaveBeenCalled();
    expect(lookupNatural).not.toHaveBeenCalled();
    expect(lookupLoose).not.toHaveBeenCalled();
  });
  it('rien de sûr (ou interrupteur éteint) : la carte, comme avant', async () => {
    const annecy = place('Annecy', { kind: 'city' });
    lookupDestination.mockResolvedValue(annecy);
    expect(await resolvePlaceByName('Annecy')).toEqual(annecy);
    expect(referentialPlaceSearch).toHaveBeenCalledTimes(1);
    expect(lookupDestination).toHaveBeenCalledWith('Annecy');
  });
  it('base en panne (rejet) : la carte, comme avant, puis le spécialiste et le reste', async () => {
    referentialPlaceSearch.mockRejectedValue(new Error('base'));
    const base = place('Villard-de-Lans');
    const specialist = vi.fn().mockResolvedValue(base);
    expect(await resolvePlaceByName('Vercors', specialist)).toEqual(base);
    expect(lookupDestination).toHaveBeenCalledWith('Vercors');
    expect(specialist).toHaveBeenCalledWith('Vercors');
  });
  it('rien nulle part : le lieu naturel puis le premier lieu habité, comme avant', async () => {
    lookupNatural.mockResolvedValue(
      place('Parc national des Calanques', { kind: 'national_park' })
    );
    expect((await resolvePlaceByName('Calanques'))?.name).toBe('Calanques');
    lookupNatural.mockResolvedValue(null);
    const loose = place('Ailleurs');
    lookupLoose.mockResolvedValue(loose);
    expect(await resolvePlaceByName('Ailleurs')).toEqual(loose);
  });
});
