import { describe, expect, it } from 'vitest';
import { analyzeDifficulty } from '../difficulty';
import { analyzeSurfaces } from '../surfaces';
import type { AnalysisSport } from '../types';

const paved = analyzeSurfaces({
  totalLengthM: 10_000,
  sections: [{ fromM: 0, toM: 10_000, surface: 'asphalt' }],
});

const natural = analyzeSurfaces({
  totalLengthM: 10_000,
  sections: [{ fromM: 0, toM: 10_000, surface: 'rock' }],
});

describe('K2.21 + S3.26 — difficulté et durée', () => {
  it('publie une difficulté expliquée et une durée standard non personnalisée', () => {
    const result = analyzeDifficulty({
      sport: 'marche',
      distanceM: 10_000,
      gainM: 500,
      lossM: 500,
      maxAltitudeM: 1500,
      surface: paved,
    });

    expect(result.status).toBe('available');
    expect(result.effortKm).toBe(15);
    expect(result.level).toBe(2);
    expect(result.levelLabel).toBe('Modérée');
    expect(result.duration.basis).toBe('standard');
    expect(result.duration.personalized).toBe(false);
    expect(result.duration.seconds).toBeGreaterThan(12_500);
    expect(result.duration.seconds).toBeLessThan(13_500);
    expect(result.factors.map((factor) => factor.id)).toContain('distance');
    expect(result.factors.map((factor) => factor.id)).toContain('ascent');
  });

  it('utilise un profil sportif réel et le marque comme personnel', () => {
    const result = analyzeDifficulty({
      sport: 'marche',
      distanceM: 10_000,
      gainM: 500,
      lossM: 500,
      surface: paved,
      athlete: { flatSpeedKmH: 5 },
    });

    expect(result.duration.personalized).toBe(true);
    expect(result.duration.basis).toBe('personal');
    expect(result.duration.seconds).toBeLessThan(12_500);
  });

  it('pénalise une surface naturelle par rapport au goudron', () => {
    const base = analyzeDifficulty({
      sport: 'marche',
      distanceM: 10_000,
      gainM: 500,
      lossM: 500,
      surface: paved,
    });
    const rough = analyzeDifficulty({
      sport: 'marche',
      distanceM: 10_000,
      gainM: 500,
      lossM: 500,
      surface: natural,
    });

    expect(rough.duration.seconds).toBeGreaterThan(base.duration.seconds ?? 0);
    expect(rough.effortKm).toBeGreaterThan(base.effortKm);
  });

  it('refuse de publier une difficulté sans dénivelé positif', () => {
    const result = analyzeDifficulty({
      sport: 'marche',
      distanceM: 10_000,
      gainM: null,
      lossM: 500,
    });

    expect(result.status).toBe('unavailable');
    expect(result.missing[0].code).toBe('elevation_missing');
    expect(result.duration.seconds).toBeNull();
  });

  it('rend la durée partielle quand la descente manque, sans inventer zéro', () => {
    const result = analyzeDifficulty({
      sport: 'marche',
      distanceM: 10_000,
      gainM: 500,
      lossM: null,
      surface: paved,
    });

    expect(result.status).toBe('partial');
    expect(result.duration.status).toBe('partial');
    expect(result.duration.missing.map((gap) => gap.code)).toContain('descent_missing');
  });

  it('refuse un sport non modélisé', () => {
    const result = analyzeDifficulty({
      sport: 'escalade' as unknown as AnalysisSport,
      distanceM: 1000,
      gainM: 100,
    });

    expect(result.status).toBe('unavailable');
    expect(result.missing[0].code).toBe('unsupported_sport');
  });
});
