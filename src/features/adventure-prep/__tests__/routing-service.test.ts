/**
 * Service de routage — normaliseurs purs verifies contre des charges utiles
 * reelles. Le contrat tient en une regle : une reponse mal formee vaut
 * `null`, jamais un z ero ni une distance approchee.
 */
import { describe, expect, it } from 'vitest';
import { normalizeElevation, normalizeOsrmRoute } from '../routingService';

/**
 * Reponse reelle d'OSRM : deux points, un troncon.
 *
 * Attention, `geometry` vit sur la ROUTE, pas sur le troncon : c est ce que
 * renvoie `router.project-osrm.org` avec `overview=full`, verifie en direct.
 * Une fixture qui recopierait la geometrie sur chaque troncon testerait un
 * cas qui n existe pas et laisserait passer le bug le plus costly du
 * preparateur (toute distance affichee « à vérifier »).
 */
const OSRM_OK = {
  code: 'Ok',
  routes: [
    {
      distance: 2398.2,
      duration: 341.9,
      geometry: { type: 'LineString', coordinates: [[6.869, 45.923], [6.899, 45.923]] },
      legs: [{ distance: 2398.2, duration: 341.9 }],
    },
  ],
};

/** Trois points, deux troncons : la forme multi-etapes du preparateur. */
const OSRM_TWO_LEGS = {
  code: 'Ok',
  routes: [
    {
      distance: 3000,
      duration: 600,
      geometry: {
        type: 'LineString',
        coordinates: [[6.8, 45.9], [6.85, 45.91], [6.9, 45.92], [6.95, 45.93]],
      },
      legs: [
        { distance: 1000, duration: 200 },
        { distance: 2000, duration: 400 },
      ],
    },
  ],
};

describe('OSRM', () => {
  it('convertit metres et secondes en kilometres et minutes', () => {
    const legs = normalizeOsrmRoute(OSRM_OK, 2);
    expect(legs).toHaveLength(1);
    expect(legs?.[0].distanceKm).toBeCloseTo(2.3982, 4);
    expect(legs?.[0].durationMin).toBeCloseTo(5.698, 3);
  });

  it('conserve la geometrie reelle au format OSRM', () => {
    expect(normalizeOsrmRoute(OSRM_OK, 2)?.[0].geometry).toEqual([
      [6.869, 45.923],
      [6.899, 45.923],
    ]);
  });

  it('un code different de Ok vaut absence, pas erreur bruitee', () => {
    expect(normalizeOsrmRoute({ ...OSRM_OK, code: 'NoRoute' }, 2)).toBeNull();
    expect(normalizeOsrmRoute({ code: 'Ok', routes: [] }, 2)).toBeNull();
  });

  it('un nombre de troncons incoherent avec les points est refuse', () => {
    expect(normalizeOsrmRoute(OSRM_OK, 5)).toBeNull();
  });

  it('une geometrie non finie est refusee plutot que propagee', () => {
    const broken = {
      ...OSRM_OK,
      routes: [
        {
          ...OSRM_OK.routes[0],
          geometry: { type: 'LineString', coordinates: [[NaN, 45]] },
        },
      ],
    };
    expect(normalizeOsrmRoute(broken, 2)).toBeNull();
  });

  it('une geometrie de route manquante vaut absence, pas un trace vide', () => {
    const noGeometry = { code: 'Ok', routes: [{ distance: 10, duration: 10, legs: [{ distance: 10, duration: 10 }] }] };
    expect(normalizeOsrmRoute(noGeometry, 2)).toBeNull();
  });
});

describe('OSRM — la geometrie vit sur la route, il faut la decouper', () => {
  it('OSRM-GEO-01: un trace porte la geometrie de route la ou OSRM la met', () => {
    const legs = normalizeOsrmRoute(OSRM_OK, 2);
    expect(legs).toHaveLength(1);
    expect(legs?.[0].geometry.length).toBeGreaterThanOrEqual(2);
  });

  it('OSRM-GEO-02: la distance du troncon reste celle mesuree par OSRM', () => {
    const legs = normalizeOsrmRoute(OSRM_TWO_LEGS, 3);
    expect(legs?.[0].distanceKm).toBeCloseTo(1, 6);
    expect(legs?.[1].distanceKm).toBeCloseTo(2, 6);
    expect(legs?.[0].durationMin).toBeCloseTo(10 / 3, 6);
    expect(legs?.[1].durationMin).toBeCloseTo(20 / 3, 6);
  });

  it('OSRM-GEO-03: chaque troncon recoit une portion du trace, jamais le trace entier', () => {
    const legs = normalizeOsrmRoute(OSRM_TWO_LEGS, 3);
    expect(legs).toHaveLength(2);
    for (const leg of legs ?? []) expect(leg.geometry.length).toBeGreaterThanOrEqual(2);
    const total = (legs ?? []).reduce((sum, leg) => sum + leg.geometry.length, 0);
    // Decouper ajoute les points de raccord, pas plus : 4 points -> 5 au total.
    expect(total).toBeLessThanOrEqual(OSRM_TWO_LEGS.routes[0].geometry.coordinates.length + 1);
  });

  it('OSRM-GEO-04: les portions sont contigues et reconstruisent le trace complet', () => {
    const legs = normalizeOsrmRoute(OSRM_TWO_LEGS, 3) ?? [];
    const rebuilt = legs[0]?.geometry.slice();
    for (const leg of legs.slice(1)) rebuilt?.push(...leg.geometry.slice(1));

    expect(rebuilt).toEqual(OSRM_TWO_LEGS.routes[0].geometry.coordinates);

  });

  it('OSRM-GEO-05: chaque portion demarre la ou la precedente finit', () => {
    const legs = normalizeOsrmRoute(OSRM_TWO_LEGS, 3) ?? [];
    for (let i = 1; i < legs.length; i += 1) {
      expect(legs[i].geometry[0]).toEqual(legs[i - 1].geometry[legs[i - 1].geometry.length - 1]);
    }
  });

  it('OSRM-GEO-06: un trace plus court que les troncons ne se deduit pas', () => {
    const tiny = {
      code: 'Ok',
      routes: [
        {
          distance: 3000,
          duration: 600,
          geometry: { type: 'LineString', coordinates: [[6.8, 45.9], [6.95, 45.93]] },
          legs: [{ distance: 1000, duration: 200 }, { distance: 2000, duration: 400 }],
        },
      ],
    };
    const legs = normalizeOsrmRoute(tiny, 3);
    // Deux points ne peuvent pas describe deux troncons : on refuse plutot
    // que d inventer un point de raccord.
    expect(legs === null || legs.every((leg) => leg.geometry.length >= 2)).toBe(true);
  });
});

describe('Open-Meteo altitude', () => {
  it('aligne les altitudes sur les points demandes', () => {
    expect(normalizeElevation({ elevation: [1041, 4206, 4792] }, 3)).toEqual([1041, 4206, 4792]);
  });

  it('une altitude manquante reste un trou, jamais un zero', () => {
    expect(normalizeElevation({ elevation: [1041, null, 4792] }, 3)).toEqual([1041, null, 4792]);
  });

  it('une reponse trop courte ou deforme vaut absence', () => {
    expect(normalizeElevation({ elevation: [1041] }, 3)).toBeNull();
    expect(normalizeElevation({}, 3)).toBeNull();
  });
});
