import { describe, expect, it } from 'vitest';
import { resolveStreetView } from '../engine/streetView';
import type { StreetViewProvider } from '../types';

const point = { lat: 45.9237, lng: 6.8694 };

function provider(headingDeg = 0, distanceM = 5): StreetViewProvider {
  return {
    lookup: () => ({
      panoId: 'pano-1',
      point: { lat: point.lat + distanceM / 111_132, lng: point.lng },
      headingDeg,
      capturedAt: '2026-01-01T00:00:00.000Z',
    }),
  };
}

describe('K2.25 — vue de rue', () => {
  it('sans fournisseur, annonce l’absence sans inventer de panorama', () => {
    expect(resolveStreetView(point, 0, null)).toMatchObject({
      available: false,
      reason: 'provider-absent',
      panoId: null,
    });
  });

  it('refuse un point invalide', () => {
    expect(resolveStreetView({ lat: Number.NaN, lng: 0 }, 0, provider())).toMatchObject({
      available: false,
      reason: 'invalid-point',
    });
  });

  it('oriente la vue selon le déplacement et n’expose pas le point', () => {
    const result = resolveStreetView(point, 90, provider(0));
    expect(result.available).toBe(true);
    expect(result.direction).toBe('right');
    expect(result.headingDeg).toBe(0);
    expect(result.panoId).toBe('pano-1');
    expect(JSON.stringify(result)).not.toContain('45.9237');
  });

  it('refuse une couverture trop lointaine', () => {
    expect(resolveStreetView(point, 0, provider(0, 120), 50)).toMatchObject({
      available: false,
      reason: 'no-coverage',
    });
  });

  it('un fournisseur en erreur ne casse pas la carte', () => {
    const broken: StreetViewProvider = {
      lookup: () => {
        throw new Error('offline');
      },
    };
    expect(resolveStreetView(point, 0, broken)).toMatchObject({
      available: false,
      reason: 'no-coverage',
    });
  });
});
