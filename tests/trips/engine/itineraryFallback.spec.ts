import { describe, it, expect } from 'vitest';
import { generateItinerary, buildItinerary } from '@/features/trips/engine/buildItinerary';

describe('Sous-phase 1.1 (D1) — Fallback du générateur d’itinéraire (TDD)', () => {
  it('TEST-FALLBACK-01: generateItinerary({days:28, slug:null, country:"FR"}) -> length === 28 et non vide', () => {
    const result = generateItinerary({
      days: 28,
      slug: null,
      country: 'FR',
    });

    expect(result.steps).toHaveLength(28);
    expect(result.total_days).toBe(28);
    expect(['skeleton', 'computed', 'template']).toContain(result.source);
    expect(result.steps[0].day_number).toBe(1);
    expect(result.steps[27].day_number).toBe(28);
    // Invariant: jamais de retour []
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('TEST-FALLBACK-02: generateItinerary({days:1}) -> length === 1', () => {
    const result = generateItinerary({
      days: 1,
    });

    expect(result.steps).toHaveLength(1);
    expect(result.total_days).toBe(1);
    expect(result.steps[0].day_number).toBe(1);
  });

  it('TEST-FALLBACK-03: generateItinerary({days:400}) -> borne respectée, pas de timeout', () => {
    const start = performance.now();
    const result = generateItinerary({
      days: 400,
    });
    const duration = performance.now() - start;

    expect(result.steps).toHaveLength(400);
    expect(result.total_days).toBe(400);
    expect(duration).toBeLessThan(200);
  });

  it('TEST-FALLBACK-04: Tier 2 (Paramétrique) — Distance totale reconstituée = somme des étapes (± 0,5 km)', () => {
    const totalDistanceKm = 145.5;
    const totalElevationGainM = 6200;
    const days = 14;

    const result = generateItinerary({
      days,
      totalDistanceKm,
      totalElevationGainM,
      country: 'FR',
    });

    expect(result.source).toBe('computed');
    expect(result.steps).toHaveLength(14);

    const sumDistance = result.steps.reduce((acc, s) => acc + (s.distance_km || 0), 0);
    const sumElevation = result.steps.reduce((acc, s) => acc + (s.elevation_gain_m || 0), 0);

    expect(Math.abs(sumDistance - totalDistanceKm)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(sumElevation - totalElevationGainM)).toBeLessThanOrEqual(10);

    const day7 = result.steps.find((s) => s.day_number === 7);
    expect(day7).toBeDefined();
    expect(day7?.title.toLowerCase()).toMatch(/repos|récupération/);
    expect(day7?.distance_km).toBe(0);
    expect(day7?.elevation_gain_m).toBe(0);
  });

  it('TEST-FALLBACK-05: Déterminisme absolu — 2 appels identiques produisent des sorties identiques', () => {
    const params = {
      days: 21,
      totalDistanceKm: 250,
      totalElevationGainM: 9000,
      country: 'FR',
      pace: 'standard' as const,
    };

    const call1 = generateItinerary(params);
    const call2 = generateItinerary(params);

    expect(JSON.stringify(call1)).toBe(JSON.stringify(call2));
  });

  it('TEST-FALLBACK-06: Cas dégradés — days:0, days:null, distance négative, dénivelé nul', () => {
    const zeroDays = generateItinerary({ days: 0 });
    expect(zeroDays.steps.length).toBeGreaterThanOrEqual(1);

    const nullDays = generateItinerary({ days: null as any });
    expect(nullDays.steps.length).toBeGreaterThanOrEqual(1);

    const negativeDist = generateItinerary({ days: 5, totalDistanceKm: -50 });
    expect(negativeDist.steps).toHaveLength(5);
    expect(negativeDist.total_distance_km).toBe(0);

    const zeroElev = generateItinerary({ days: 3, totalDistanceKm: 40, totalElevationGainM: 0 });
    expect(zeroElev.steps).toHaveLength(3);
    expect(zeroElev.total_elevation_gain_m).toBe(0);
  });

  it('TEST-FALLBACK-07: Tier 1 (Template) — Reconnaît les slugs pilotes (ex: gr20, toubkal, laugavegur)', () => {
    const gr20Result = generateItinerary({
      days: 16,
      slug: 'gr20',
      country: 'FR',
    });

    expect(gr20Result.source).toBe('template');
    expect(gr20Result.sourceLabel).toContain('GR20');
    expect(gr20Result.steps.length).toBeGreaterThan(0);
  });

  it('TEST-FALLBACK-08: Tier 3 (Squelette) — Bannière explicite quand aucune donnée de référence', () => {
    const skeletonResult = generateItinerary({
      days: 5,
      slug: null,
      country: 'ZZ',
    });

    expect(skeletonResult.source).toBe('skeleton');
    expect(skeletonResult.steps).toHaveLength(5);
    const skeletonWarning = skeletonResult.warnings.find((w) => w.code === 'SKELETON_ITINERARY');
    expect(skeletonWarning).toBeDefined();
    expect(skeletonWarning?.message).toContain('Aucun tracé de référence pour cette destination');
  });

  it('TEST-FALLBACK-09: buildItinerary intègre le contrat de repli sans jamais renvoyer steps: []', () => {
    const output = buildItinerary(
      {
        countries: [{ country_code: 'ZZ' }],
        duration_days: 10,
        styles: ['hiking'],
        pace: 'standard',
        travelers_count: 2,
      },
      {
        candidateSteps: [],
        candidateItems: [],
      }
    );

    expect(output.steps).toHaveLength(10);
    expect(output.source).toBe('skeleton');
  });
});
