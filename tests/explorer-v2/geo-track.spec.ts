import { describe, expect, it } from 'vitest';
import {
  decimateTrack,
  haversineM,
  isValidLngLat,
  resampleTrack,
  summarizeElevation,
  trackRevision,
} from '@/features/explorer-v2/geo/track';

/**
 * Moteur géo partagé (Explorer v2) : le rééchantillonnage était dupliqué entre
 * `workers/geo.worker.ts` et `api/explorer/v2/profile`, avec dans la version
 * worker une progression non monotone (`cursor = nextAt`) qui bouclait à
 * l'infini sur tout segment plus long que `stepM` (OOM prouvé, cf.
 * docs/cleanup/evidence/resample-oom.txt).
 *
 * Ces tests portent la correction : distance cumulée monotone, bornes de ratio,
 * points répétés/NaN/step invalide, antiméridien et borne du nombre de points.
 */

const PARIS: [number, number] = [2.3522, 48.8566];
/** 1 km plein nord depuis Paris (111,32 m par centième de degré de latitude). */
const ONE_KM_NORTH: [number, number] = [2.3522, 48.8566 + 1000 / 111320];

describe('geo/track · validation des coordonnées', () => {
  it('accepte [lng, lat] dans les bornes', () => {
    expect(isValidLngLat([2.35, 48.85])).toBe(true);
    expect(isValidLngLat([180, 90])).toBe(true);
    expect(isValidLngLat([-180, -90])).toBe(true);
  });

  it('refuse NaN, infini, hors bornes et ordre inversé [lat, lng]', () => {
    expect(isValidLngLat([NaN, 48])).toBe(false);
    expect(isValidLngLat([Infinity, 48])).toBe(false);
    expect(isValidLngLat([2.35, 91])).toBe(false);
    expect(isValidLngLat([-181, 48])).toBe(false);
    // 48.85 est une latitude : dans une paire [lng, lat], c'est hors bornes.
    expect(isValidLngLat([48.85, 2.35])).toBe(true);
    expect(isValidLngLat(['2', 48])).toBe(false);
  });
});

describe('geo/track · haversine', () => {
  it('renvoie 0 pour deux points identiques', () => {
    expect(haversineM(PARIS, PARIS)).toBe(0);
  });

  it('mesure un kilomètre à ~1 % près', () => {
    const distance = haversineM(PARIS, ONE_KM_NORTH);
    expect(distance).toBeGreaterThan(990);
    expect(distance).toBeLessThan(1010);
  });

  it('franchit l’antiméridien sans distance absurde', () => {
    const distance = haversineM([179.999, 45], [-179.999, 45]);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(200);
  });

  it('renvoie NaN sur une coordonnée invalide (jamais une distance inventée)', () => {
    expect(Number.isNaN(haversineM([NaN, 45], [0, 45]))).toBe(true);
  });
});

describe('geo/track · resampleTrack', () => {
  it('renvoie [] sans point', () => {
    expect(resampleTrack([], 60)).toEqual([]);
  });

  it('conserve le point de départ et la distance 0 avec un seul point', () => {
    expect(resampleTrack([PARIS], 60)).toEqual([{ position: PARIS, distance_m: 0 }]);
  });

  it('échoue en boucle sur un segment plus long que le pas : régression P0', () => {
    // Avant correction, ce cas simple (1 km, pas de 60 m) saturait le tas.
    const started = Date.now();
    const samples = resampleTrack([PARIS, ONE_KM_NORTH], 60);
    expect(Date.now() - started).toBeLessThan(500);
    expect(samples.length).toBeGreaterThan(10);
    expect(samples.length).toBeLessThan(40);
  });

  it('produit une distance strictement monotone et bornée par la trace', () => {
    const samples = resampleTrack([PARIS, ONE_KM_NORTH], 60);
    const total = haversineM(PARIS, ONE_KM_NORTH);
    expect(samples[0]).toEqual({ position: PARIS, distance_m: 0 });
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index].distance_m).toBeGreaterThan(samples[index - 1].distance_m);
      expect(samples[index].distance_m).toBeLessThanOrEqual(total + 1e-6);
    }
    // Le pas demandé est respecté à la tolérance flottante près.
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index].distance_m - samples[index - 1].distance_m).toBeCloseTo(60, 6);
    }
  });

  it('interpole les positions entre les extrémités, sans les dépasser', () => {
    const samples = resampleTrack([PARIS, ONE_KM_NORTH], 60);
    for (const sample of samples) {
      expect(sample.position[1]).toBeGreaterThanOrEqual(PARIS[1] - 1e-9);
      expect(sample.position[1]).toBeLessThanOrEqual(ONE_KM_NORTH[1] + 1e-9);
      expect(sample.position[0]).toBeCloseTo(PARIS[0], 9);
    }
  });

  it('ignore les points répétés sans créer de distance ni de NaN', () => {
    const samples = resampleTrack([PARIS, PARIS, PARIS, ONE_KM_NORTH], 100);
    expect(samples.length).toBe(10);
    expect(samples.every((sample) => Number.isFinite(sample.distance_m))).toBe(true);
    expect(samples.every((sample) => Number.isFinite(sample.position[0]) && Number.isFinite(sample.position[1]))).toBe(true);
  });

  it('écarte les coordonnées non finies ou hors bornes', () => {
    const samples = resampleTrack(
      [PARIS, [NaN, 48] as [number, number], [2.3522, 200] as [number, number], ONE_KM_NORTH],
      100,
    );
    expect(samples.length).toBe(10);
    expect(samples.every((sample) => Number.isFinite(sample.position[1]))).toBe(true);
  });

  it('ramène un pas nul, négatif ou NaN au pas par défaut sans boucler', () => {
    for (const step of [0, -60, Number.NaN, Number.POSITIVE_INFINITY]) {
      const samples = resampleTrack([PARIS, ONE_KM_NORTH], step);
      expect(samples.length).toBeGreaterThan(1);
      expect(samples.length).toBeLessThan(40);
    }
  });

  it('normalise la longitude au franchissement de l’antiméridien', () => {
    const samples = resampleTrack(
      [
        [179.998, 45],
        [-179.998, 45],
      ],
      50,
    );
    expect(samples.length).toBeGreaterThan(3);
    for (const sample of samples) {
      expect(sample.position[0]).toBeGreaterThanOrEqual(-180);
      expect(sample.position[0]).toBeLessThanOrEqual(180);
    }
  });

  it('borne le nombre de points même avec un pas dérisoire (garde anti-OOM)', () => {
    const samples = resampleTrack([PARIS, ONE_KM_NORTH], 1e-9, { maxSamples: 500 });
    expect(samples.length).toBeLessThanOrEqual(501);
  });

  it('tient une trace de 10 000 points sinueuse en moins d’une seconde', () => {
    const positions: Array<[number, number]> = [];
    for (let index = 0; index < 10_000; index += 1) {
      positions.push([2.35 + index * 0.0002, 45.9 + Math.sin(index / 40) * 0.01]);
    }
    const started = Date.now();
    const samples = resampleTrack(positions, 250);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(samples.length).toBeGreaterThan(100);
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index].distance_m).toBeGreaterThan(samples[index - 1].distance_m);
    }
  });
});

describe('geo/track · decimateTrack', () => {
  it('ne touche pas une trace sous la limite', () => {
    const positions: Array<[number, number]> = [PARIS, ONE_KM_NORTH];
    expect(decimateTrack(positions, 400)).toBe(positions);
  });

  it('conserve la dernière position physique', () => {
    const positions = Array.from({ length: 1000 }, (_, index) => [2 + index * 0.001, 45] as [number, number]);
    const decimated = decimateTrack(positions, 10);
    expect(decimated.length).toBeLessThanOrEqual(11);
    expect(decimated[decimated.length - 1]).toEqual(positions[positions.length - 1]);
  });
});

describe('geo/track · trackRevision (clé de cache du profil)', () => {
  const trace: Array<[number, number]> = [
    [6.87, 45.92],
    [6.872, 45.921],
    [6.874, 45.922],
  ];

  it('est stable pour un même contenu', () => {
    expect(trackRevision(trace)).toBe(trackRevision(trace.map((point) => [...point] as [number, number])));
  });

  it('change quand un point intermédiaire bouge (même longueur, même départ)', () => {
    const mutated = trace.map((point) => [...point] as [number, number]);
    mutated[1] = [6.873, 45.9215];
    expect(trackRevision(mutated)).not.toBe(trackRevision(trace));
  });

  it('change avec les paramètres de calcul', () => {
    expect(trackRevision(trace, { stepM: 80 })).not.toBe(trackRevision(trace, { stepM: 60 }));
    expect(trackRevision(trace, { demZoom: 11 })).not.toBe(trackRevision(trace, { demZoom: 10 }));
  });
});

describe('geo/track · summarizeElevation', () => {
  const points = [
    { d: 0, ele: 1000 },
    { d: 60, ele: 1012 },
    { d: 120, ele: null },
    { d: 180, ele: 1004 },
    { d: 240, ele: 990.4 },
  ];

  it('cumule les dénivelés sur les paires renseignées en ignorant les trous', () => {
    const summary = summarizeElevation(points, 240);
    expect(summary.gain_m).toBe(12);
    expect(summary.loss_m).toBe(14);
    expect(summary.min_m).toBe(990);
    expect(summary.max_m).toBe(1012);
    expect(summary.distance_m).toBe(240);
  });

  it('ne prétend à aucun dénivelé quand aucune altitude n’est connue', () => {
    const summary = summarizeElevation([{ d: 0, ele: null }, { d: 10, ele: null }], 10);
    expect(summary).toEqual({ distance_m: 10, gain_m: 0, loss_m: 0, min_m: null, max_m: null });
  });
});
