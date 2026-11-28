import { describe, expect, it } from 'vitest';
import { resolveActivityProfile } from '../../specs/resolveActivityProfile';
import {
  applyEpzTruncation,
  computeDeterministicEpzJitterM,
  filterHeatmapCellByKAnonymity,
  generateShiftedEpzCircle,
  haversineDistanceM,
} from '../epzEngine';
import { evaluateActivityIntegrity } from '../../integrity/antiCheatEngine';

describe('Lot 09 — EPZ Anti-Triangulation, k-Anonymat & Anti-Triche (T16 / T17)', () => {
  it('décale le centre EPZ entre 0,25 R et 0,60 R et tronque en dual EPZ vélotaf (T16)', () => {
    const home = generateShiftedEpzCircle({
      zoneId: 'home-1',
      label: 'Domicile',
      realLat: 45.9,
      realLng: 6.12,
      radiusM: 500,
    });
    const shiftM = haversineDistanceM(home.realLat, home.realLng, home.shiftedLat, home.shiftedLng);
    expect(shiftM).toBeGreaterThanOrEqual(500 * 0.24);
    expect(shiftM).toBeLessThanOrEqual(500 * 0.61);

    const jitterA = computeDeterministicEpzJitterM('sess-A', 'home-1');
    const jitterB = computeDeterministicEpzJitterM('sess-B', 'home-1');
    expect(jitterA).toBeGreaterThanOrEqual(0);
    expect(jitterA).toBeLessThanOrEqual(150);
    expect(jitterA).toBe(computeDeterministicEpzJitterM('sess-A', 'home-1'));
    expect(jitterB).toBeGreaterThanOrEqual(0);

    // Dual EPZ : trajet de 4 km entre Domicile (45.900) et Travail (45.936)
    const work = generateShiftedEpzCircle({
      zoneId: 'work-1',
      label: 'Travail',
      realLat: 45.936,
      realLng: 6.12,
      radiusM: 400,
    });
    const points = Array.from({ length: 41 }, (_, i) => ({
      lat: 45.9 + i * 0.0009, // ~100 m par pas -> 4 km total
      lng: 6.12,
      t: 1_700_000_000_000 + i * 20_000,
    }));

    const truncated = applyEpzTruncation(points, [home, work], 'sess-commute-1', 50);
    expect(truncated.fullyMasked).toBe(false);
    expect(truncated.trimmedStartCount).toBeGreaterThan(0);
    expect(truncated.trimmedEndCount).toBeGreaterThan(0);
    expect(truncated.publicPoints.length).toBeLessThan(points.length);

    // Vérifie qu'aucun point public de début/fin n'est à l'intérieur du rayon + 50m
    const firstPub = truncated.publicPoints[0];
    expect(haversineDistanceM(firstPub.lat, firstPub.lng, home.shiftedLat, home.shiftedLng)).toBeGreaterThan(
      home.radiusM + 50,
    );

    // k-anonymat heatmap strict k >= 10
    expect(filterHeatmapCellByKAnonymity(9)).toBe(false);
    expect(filterHeatmapCellByKAnonymity(10)).toBe(true);
  });

  it('isole les eBike, détecte voiture oubliée (auto-crop) et remontées mécaniques (T17)', () => {
    const running = resolveActivityProfile('running');
    const t0 = 1_700_000_000_000;

    // 5 segments normaux à 10 km/h puis 5 segments en voiture à ~72 km/h
    const ptsWithCar = [
      ...Array.from({ length: 6 }, (_, i) => ({
        lat: 45.9 + i * 0.00025, // ~27.8 m / 10s = 10 km/h
        lng: 6.12,
        ele: 500,
        t: t0 + i * 10_000,
      })),
      ...Array.from({ length: 6 }, (_, j) => ({
        lat: 45.9 + 5 * 0.00025 + (j + 1) * 0.0018, // ~200 m / 10s = 72 km/h
        lng: 6.12,
        ele: 500,
        t: t0 + (6 + j) * 10_000,
      })),
    ];

    const carEval = evaluateActivityIntegrity(running, ptsWithCar, {
      sourceOrigin: 'lkdv_native',
    });
    expect(carEval.flags).toContain('motorized_vehicle_detected');
    expect(carEval.suggestedAutoCropIndex).not.toBeNull();
    expect(carEval.eligibleForMuscularLeaderboards).toBe(false);

    // Isolation eBike
    const cycling = resolveActivityProfile('road_cycling');
    const ebikePts = Array.from({ length: 6 }, (_, i) => ({
      lat: 45.9 + i * 0.0006, // ~24 km/h
      lng: 6.12,
      ele: 500 + i * 2,
      t: t0 + i * 10_000,
    }));
    const ebikeEval = evaluateActivityIntegrity(cycling, ebikePts, {
      sourceOrigin: 'lkdv_native',
      isElectricAssisted: true,
    });
    expect(ebikeEval.leaderboardCategory).toBe('electric_assisted');
    expect(ebikeEval.eligibleForMuscularLeaderboards).toBe(false);

    // Remontée mécanique ski (vitesse 5 m/s en montée constante)
    const ski = resolveActivityProfile('ski_touring');
    const liftPts = Array.from({ length: 8 }, (_, i) => ({
      lat: 45.9 + i * 0.00045, // 50 m / 10 s = 5 m/s
      lng: 6.12,
      ele: 1600 + i * 18,
      t: t0 + i * 10_000,
    }));
    const liftEval = evaluateActivityIntegrity(ski, liftPts, {
      sourceOrigin: 'lkdv_native',
    });
    expect(liftEval.flags).toContain('mechanical_lift_detected');
    expect(liftEval.liftAscentExcludedM).toBeGreaterThan(0);
  });
});
