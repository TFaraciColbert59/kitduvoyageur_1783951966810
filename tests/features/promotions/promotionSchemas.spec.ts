import { describe, expect, it } from 'vitest';
import {
  MODEL_VERSION_PATTERN,
  evaluatePromotionRequestSchema,
  modelVersionSchema,
  promoteModelRequestSchema,
  promotionEvidenceSchema,
  promotionScoreSchema,
} from '@/features/promotions/server/promotionSchemas';

const validEvidence = { dataset: 'holdout-2026-09', n: 128, auc: 0.9123 };

describe('modelVersionSchema', () => {
  it('accepte les versions conformes au CHECK SQL', () => {
    for (const version of ['v1', '1.0.0', 'model_2026-09-26', 'A1', 'x'.repeat(120)]) {
      expect(modelVersionSchema.safeParse(version).success, version).toBe(true);
    }
  });

  it('refuse ce que la regex SQL refuse', () => {
    // Miroir strict de ^[A-Za-z0-9][A-Za-z0-9._-]{1,119}$
    // NB : trim() est applique AVANT la regex, donc 'v1\n' est valide (espaces
    // peripheriques tolerees) ; c'est la valeur trimmed qui part en base, donc
    // le CHECK SQL reste satisfait.
    for (const version of ['', 'a', '-v1', '.v1', '_v1', 'v 1', 'v/1', '\u00e91']) {
      expect(modelVersionSchema.safeParse(version).success, version).toBe(false);
    }
    expect(MODEL_VERSION_PATTERN.test('x'.repeat(121))).toBe(false);
  });

  it('normalise les espaces peripheriques avant la regex', () => {
    expect(modelVersionSchema.parse('  v1.2.3  ')).toBe('v1.2.3');
    expect(modelVersionSchema.parse('v1.2.3\n')).toBe('v1.2.3');
  });
});

describe('promotionScoreSchema', () => {
  it('borne le score a [0, 1]', () => {
    expect(promotionScoreSchema.safeParse(0).success).toBe(true);
    expect(promotionScoreSchema.safeParse(1).success).toBe(true);
    expect(promotionScoreSchema.safeParse(0.5).success).toBe(true);
    for (const score of [-0.0001, 1.0001, Number.NaN, '0.5', null, undefined]) {
      expect(promotionScoreSchema.safeParse(score).success, String(score)).toBe(false);
    }
  });
});

describe('promotionEvidenceSchema', () => {
  it('accepte un objet JSON borne', () => {
    expect(promotionEvidenceSchema.safeParse(validEvidence).success).toBe(true);
    expect(promotionEvidenceSchema.safeParse({}).success).toBe(true);
  });

  it('refuse plus de 64 cles', () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 65; i += 1) many['k' + i] = i;
    expect(promotionEvidenceSchema.safeParse(many).success).toBe(false);
    const exactly64: Record<string, number> = {};
    for (let i = 0; i < 64; i += 1) exactly64['k' + i] = i;
    expect(promotionEvidenceSchema.safeParse(exactly64).success).toBe(true);
  });

  it('refuse une evidence volumineuse (> 16 Kio)', () => {
    const heavy = { blob: 'x'.repeat(17 * 1024) };
    expect(promotionEvidenceSchema.safeParse(heavy).success).toBe(false);
  });

  it('refuse une evidence trop imbriquee (> profondeur 4)', () => {
    const deep = { a: { b: { c: { d: { e: 1 } } } } };
    expect(promotionEvidenceSchema.safeParse(deep).success).toBe(false);
    const shallow = { a: { b: { c: 1 } } };
    expect(promotionEvidenceSchema.safeParse(shallow).success).toBe(true);
  });

  it('refuse une cle vide ou trop longue', () => {
    expect(promotionEvidenceSchema.safeParse({ '': 1 }).success).toBe(false);
    expect(promotionEvidenceSchema.safeParse({ ['k'.repeat(81)]: 1 }).success).toBe(false);
  });
});

describe('evaluatePromotionRequestSchema', () => {
  it('applique promote=false par defaut', () => {
    const parsed = evaluatePromotionRequestSchema.parse({
      modelVersion: 'v1.0.0',
      score: 0.8,
      evidence: validEvidence,
    });
    expect(parsed.promote).toBe(false);
  });

  it('conserve promote=true quand demande', () => {
    const parsed = evaluatePromotionRequestSchema.parse({
      modelVersion: 'v1.0.0',
      score: 1,
      evidence: validEvidence,
      promote: true,
    });
    expect(parsed.promote).toBe(true);
  });

  it('refuse une cle inconnue', () => {
    expect(
      evaluatePromotionRequestSchema.safeParse({
        modelVersion: 'v1.0.0',
        score: 0.8,
        evidence: validEvidence,
        unexpected: true,
      }).success
    ).toBe(false);
  });

  it('refuse un promote non booleen', () => {
    expect(
      evaluatePromotionRequestSchema.safeParse({
        modelVersion: 'v1.0.0',
        score: 0.8,
        evidence: validEvidence,
        promote: 'yes',
      }).success
    ).toBe(false);
  });
});

describe('promoteModelRequestSchema', () => {
  it("n'accepte que la version, et rejette les cles inconnues", () => {
    expect(promoteModelRequestSchema.parse({ modelVersion: 'v2' })).toEqual({
      modelVersion: 'v2',
    });
    expect(promoteModelRequestSchema.safeParse({}).success).toBe(false);
    // Sans .strict(), Zod strip silencieusement score et repond 200.
    expect(promoteModelRequestSchema.safeParse({ modelVersion: 'v2', score: 1 }).success).toBe(
      false
    );
  });
});
