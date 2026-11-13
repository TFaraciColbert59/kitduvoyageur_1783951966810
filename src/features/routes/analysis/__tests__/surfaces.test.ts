import { describe, expect, it } from 'vitest';
import { analyzeSurfaces, surfaceCategory } from '../surfaces';

describe('K2.19 — surfaces et types de voie', () => {
  it('agrège les surfaces connues et calcule les parts sur la longueur totale', () => {
    const result = analyzeSurfaces({
      totalLengthM: 2000,
      sections: [
        { fromM: 0, toM: 1000, surface: 'asphalt', wayType: 'road' },
        { fromM: 1000, toM: 1500, surface: 'gravel' },
        { fromM: 1500, toM: 2000, wayType: 'steps' },
      ],
    });

    expect(result.status).toBe('available');
    expect(result.coverage).toBe(1);
    expect(result.dominant).toBe('paved');
    expect(result.shares).toEqual([
      { category: 'paved', lengthM: 1000, shareOfKnown: 0.5, shareOfRoute: 0.5 },
      { category: 'unpaved', lengthM: 500, shareOfKnown: 0.25, shareOfRoute: 0.25 },
      { category: 'steps', lengthM: 500, shareOfKnown: 0.25, shareOfRoute: 0.25 },
    ]);
    expect(result.sections[2].mapStyleKey).toBe('surface-steps');
  });

  it('laisse inconnu un tronçon sans étiquette au lieu de deviner', () => {
    const result = analyzeSurfaces({
      totalLengthM: 1000,
      sections: [
        { fromM: 0, toM: 500 },
        { fromM: 500, toM: 1000, surface: 'asphalt' },
      ],
    });

    expect(result.status).toBe('partial');
    expect(result.knownLengthM).toBe(500);
    expect(result.unknownLengthM).toBe(500);
    expect(result.coverage).toBe(0.5);
    expect(result.missing.map((gap) => gap.code)).toContain('surface_coverage_incomplete');
    expect(result.sections[0].category).toBe('unknown');
  });

  it('rend unavailable sans aucun tronçon, ou si toutes les étiquettes manquent', () => {
    expect(analyzeSurfaces({ sections: [] }).status).toBe('unavailable');
    expect(analyzeSurfaces({}).missing[0].code).toBe('surface_source_unavailable');

    const untagged = analyzeSurfaces({
      totalLengthM: 1000,
      sections: [{ fromM: 0, toM: 1000 }],
    });
    expect(untagged.status).toBe('unavailable');
    expect(untagged.missing[0].code).toBe('surface_tags_missing');
  });

  it('signale un recouvrement et ne compte pas deux fois la même distance', () => {
    const result = analyzeSurfaces({
      totalLengthM: 1000,
      sections: [
        { fromM: 0, toM: 600, surface: 'asphalt' },
        { fromM: 400, toM: 1000, surface: 'gravel' },
      ],
    });

    expect(result.status).toBe('available');
    expect(result.knownLengthM).toBe(1000);
    expect(result.warnings.map((warning) => warning.code)).toContain('surface_sections_overlap');
    expect(result.shares.find((share) => share.category === 'paved')?.lengthM).toBe(600);
    expect(result.shares.find((share) => share.category === 'unpaved')?.lengthM).toBe(400);
  });

  it('normalise les types de voie et les surfaces OSM', () => {
    expect(surfaceCategory('asphalt', 'path')).toBe('paved');
    expect(surfaceCategory('fine_gravel', 'track')).toBe('unpaved');
    expect(surfaceCategory('scree', 'path')).toBe('natural');
    expect(surfaceCategory(null, 'steps')).toBe('steps');
    expect(surfaceCategory(null, 'ferry')).toBe('ferry');
    expect(surfaceCategory(null, 'path')).toBe('unknown');
  });
});
