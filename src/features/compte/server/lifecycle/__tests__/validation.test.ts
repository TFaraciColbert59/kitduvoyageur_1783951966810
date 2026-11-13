import { describe, expect, it } from 'vitest';
import {
  ActivityIdSchema,
  CorrectionSchema,
  CropSchema,
  MetadataPatchSchema,
  parseListQuery,
  SplitSchema,
} from '../validation';

describe('A02 — validation zod des routes du cycle de vie', () => {
  it('accepte une fiche dont l’identifiant contient une partie fractionnée', () => {
    expect(ActivityIdSchema.safeParse('uuid__part_2').success).toBe(true);
    expect(ActivityIdSchema.safeParse('../../etc/passwd').success).toBe(false);
    expect(ActivityIdSchema.safeParse('').success).toBe(false);
  });

  it('refuse les champs inconnus et les sports hors taxonomie', () => {
    expect(MetadataPatchSchema.safeParse({ title: 'Ok' }).success).toBe(true);
    expect(MetadataPatchSchema.safeParse({ unknown: true }).success).toBe(false);
    expect(MetadataPatchSchema.safeParse({ sport: 'teleportation' }).success).toBe(false);
    expect(MetadataPatchSchema.safeParse({ tags: ['inconnu'] }).success).toBe(false);
  });

  it('exige au moins une borne de recadrage et un point de fractionnement', () => {
    expect(CropSchema.safeParse({}).success).toBe(false);
    expect(CropSchema.safeParse({ startIndex: 1, endIndex: 3 }).success).toBe(true);
    expect(CropSchema.safeParse({ startTimeIso: 'pas-une-date' }).success).toBe(false);

    expect(SplitSchema.safeParse({}).success).toBe(false);
    expect(SplitSchema.safeParse({ splitDistancesM: [1200] }).success).toBe(true);
    expect(SplitSchema.safeParse({ splitIndices: [] }).success).toBe(false);
  });

  it('exige une méthode de correction et borne les saisies manuelles', () => {
    expect(CorrectionSchema.safeParse({}).success).toBe(false);
    expect(
      CorrectionSchema.safeParse({
        distanceMethod: 'manual_override',
        manualDistanceM: 5000,
      }).success
    ).toBe(true);
    expect(
      CorrectionSchema.safeParse({
        distanceMethod: 'manual_override',
        manualDistanceM: -1,
      }).success
    ).toBe(false);
    expect(
      CorrectionSchema.safeParse({
        elevationMethod: 'threshold_smoothing',
        smoothingThresholdM: 99,
      }).success
    ).toBe(false);
  });

  it('parse les paramètres de liste sans accepter une limite arbitraire', () => {
    const valid = parseListQuery(new URLSearchParams({ q: 'vercors', trash: '1', limit: '20' }));
    expect(valid).toEqual({
      ok: true,
      value: { q: 'vercors', trash: '1', limit: 20 },
    });
    expect(parseListQuery(new URLSearchParams({ limit: '1000' })).ok).toBe(false);
    const ignored = parseListQuery(new URLSearchParams({ unknown: '1' }));
    expect(ignored).toEqual({ ok: true, value: {} });
  });
});
