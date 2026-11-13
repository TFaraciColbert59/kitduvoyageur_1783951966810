import { describe, expect, it } from 'vitest';
import { analyzeClimbs } from '../climbs';
import type { AnalysisSport, ProfileSample } from '../types';

function addLine(
  points: ProfileSample[],
  fromD: number,
  toD: number,
  step: number,
  fromE: number,
  toE: number
): void {
  const count = Math.round((toD - fromD) / step);
  for (let index = 0; index <= count; index += 1) {
    const ratio = count === 0 ? 0 : index / count;
    points.push({
      distanceM: fromD + (toD - fromD) * ratio,
      elevationM: fromE + (toE - fromE) * ratio,
    });
  }
}

function hillyProfile(): ProfileSample[] {
  const points: ProfileSample[] = [];
  addLine(points, 0, 1000, 100, 1000, 1000);
  addLine(points, 1100, 3000, 100, 1010, 1200);
  addLine(points, 3100, 4000, 100, 1200, 1200);
  addLine(points, 4100, 6000, 100, 1190, 1000);
  return points;
}

describe('K2.20 — montées et descentes', () => {
  it('délimite une montée et une descente, sans inclure les plats de tête et de queue', () => {
    const result = analyzeClimbs({ sport: 'marche', profile: hillyProfile() });

    expect(result.status).toBe('available');
    expect(result.climbs).toHaveLength(1);
    expect(result.descents).toHaveLength(1);

    const climb = result.climbs[0];
    expect(climb.fromM).toBe(1000);
    expect(climb.toM).toBe(3000);
    expect(climb.gainM).toBe(200);
    expect(climb.avgGradePct).toBe(10);
    expect(climb.category).toBe(2);

    const descent = result.descents[0];
    expect(descent.fromM).toBe(4000);
    expect(descent.toM).toBe(6000);
    expect(descent.lossM).toBe(200);
    expect(descent.avgGradePct).toBe(-10);
    expect(result.totalGainM).toBe(200);
    expect(result.totalLossM).toBe(200);
  });

  it('ne publie pas une bosse sous le gain minimal du sport', () => {
    const points: ProfileSample[] = [];
    addLine(points, 0, 1000, 100, 1000, 1000);
    addLine(points, 1100, 1500, 100, 1000, 1020);
    addLine(points, 1600, 2500, 100, 1020, 1000);

    const result = analyzeClimbs({ sport: 'marche', profile: points });

    expect(result.climbs).toHaveLength(0);
    expect(result.descents).toHaveLength(0);
  });

  it('coupe le profil sur une altitude absente et baisse la couverture', () => {
    const points = hillyProfile();
    const broken = points.map((point) =>
      point.distanceM === 2000 ? { ...point, elevationM: null } : point
    );

    const result = analyzeClimbs({ sport: 'marche', profile: broken });

    expect(result.status).toBe('partial');
    expect(result.elevationCoverage).toBeLessThan(1);
    expect(result.missing.map((gap) => gap.code)).toContain('elevation_coverage_incomplete');
    expect(result.warnings.map((warning) => warning.code)).toContain('elevation_holes');
  });

  it('refuse un sport non modélisé ou un profil vide', () => {
    const unsupported = analyzeClimbs({
      sport: 'escalade' as unknown as AnalysisSport,
      profile: hillyProfile(),
    });
    expect(unsupported.status).toBe('unavailable');
    expect(unsupported.missing[0].code).toBe('unsupported_sport');

    expect(analyzeClimbs({ sport: 'marche', profile: [] }).status).toBe('unavailable');
  });
});
