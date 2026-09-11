import { describe, it, expect } from 'vitest';
import {
  makeConfidence,
  combineConfidence,
  isPersonalized,
  confidenceLevelFromScore,
  COLD_CONFIDENCE,
} from '@/features/adventure-intelligence/domain/confidence';
import {
  PROVENANCE_SOURCES,
  isResolvableProvenance,
  isStale,
} from '@/features/adventure-intelligence/domain/provenance';
import { makeEngineResult, validateEngineResult } from '@/features/adventure-intelligence/domain/engine';
import {
  ADVENTURE_DOMAIN_EVENT_TYPES,
  buildDomainEvent,
} from '@/features/adventure-intelligence/domain/events';
import { ProvenanceTypeEnum } from '@/features/trips/schemas/autoGen.schema';

describe('Domaine noyau — confidence (TEST-A1-CONF)', () => {
  it('TEST-A1-CONF-01: makeConfidence borne le score dans [0,1] et dérive le niveau', () => {
    const high = makeConfidence({ score: 1.4, sampleCount: 10, method: 'test' });
    expect(high.score).toBe(1);
    expect(high.level).toBe('high');

    const low = makeConfidence({ score: -0.2, sampleCount: 0, method: 'test' });
    expect(low.score).toBe(0);
    expect(low.level).toBe('low');
    expect(low.reasons.length).toBeGreaterThan(0);
  });

  it('TEST-A1-CONF-02: seuils de niveau — 0.75 high, 0.5 medium, sinon low', () => {
    expect(confidenceLevelFromScore(0.75)).toBe('high');
    expect(confidenceLevelFromScore(0.749)).toBe('medium');
    expect(confidenceLevelFromScore(0.5)).toBe('medium');
    expect(confidenceLevelFromScore(0.499)).toBe('low');

    expect(makeConfidence({ score: 0.75, sampleCount: 3, method: 'm' }).level).toBe('high');
    expect(makeConfidence({ score: 0.5, sampleCount: 3, method: 'm' }).level).toBe('medium');
    expect(makeConfidence({ score: 0.49, sampleCount: 3, method: 'm' }).level).toBe('low');
  });

  it('TEST-A1-CONF-03: une confiance faible porte toujours des raisons', () => {
    const low = makeConfidence({ score: 0.2, sampleCount: 1, method: 'test', reasons: [] });
    expect(low.reasons.length).toBeGreaterThan(0);

    const medium = makeConfidence({ score: 0.6, sampleCount: 5, method: 'test' });
    expect(medium.reasons).toEqual([]);
  });

  it('TEST-A1-CONF-04: combineConfidence prend le min, somme les échantillons et concatène les raisons', () => {
    const a = makeConfidence({ score: 0.9, sampleCount: 4, method: 'a', reasons: ['r-a'] });
    const b = makeConfidence({ score: 0.4, sampleCount: 6, method: 'b', reasons: ['r-b'] });
    const combined = combineConfidence(a, b);

    expect(combined.score).toBe(0.4);
    expect(combined.sampleCount).toBe(10);
    expect(combined.method).toBe('combined:min');
    expect(combined.reasons).toEqual(['r-a', 'r-b']);
    expect(combined.level).toBe('low');

    const empty = combineConfidence();
    expect(empty.sampleCount).toBe(0);
    expect(empty.score).toBe(0);
    expect(empty.level).toBe('low');
    expect(empty.reasons.length).toBeGreaterThan(0);
  });

  it('TEST-A1-CONF-05: isPersonalized exige sampleCount >= 3 et score >= 0.5', () => {
    expect(isPersonalized(makeConfidence({ score: 0.6, sampleCount: 3, method: 'm' }))).toBe(true);
    expect(isPersonalized(makeConfidence({ score: 0.5, sampleCount: 2, method: 'm' }))).toBe(false);
    expect(isPersonalized(makeConfidence({ score: 0.49, sampleCount: 10, method: 'm' }))).toBe(false);
  });
});

describe('Domaine noyau — provenance (TEST-A1-PROV)', () => {
  it('TEST-A1-PROV-01: parité de taxonomie avec ProvenanceTypeEnum (trips)', () => {
    expect([...PROVENANCE_SOURCES]).toEqual(ProvenanceTypeEnum.options);
  });

  it('TEST-A1-PROV-02: official, community et measured exigent sourceRef ou observedAt', () => {
    expect(isResolvableProvenance({ source: 'official', sourceRef: 'IGN' })).toBe(true);
    expect(isResolvableProvenance({ source: 'official' })).toBe(false);
    expect(isResolvableProvenance({ source: 'community', observedAt: '2026-09-11T10:00:00.000Z' })).toBe(true);
    expect(isResolvableProvenance({ source: 'measured' })).toBe(false);
    expect(isResolvableProvenance({ source: 'computed' })).toBe(true);
    expect(isResolvableProvenance({ source: 'estimated' })).toBe(true);
    expect(isResolvableProvenance({ source: 'suggested' })).toBe(true);
  });

  it('TEST-A1-PROV-03: isStale compare observedAt à la fenêtre maxAgeSeconds', () => {
    const now = '2026-09-11T12:00:00.000Z';
    expect(isStale({ source: 'community', observedAt: '2026-09-11T10:00:00.000Z' }, now, 3600)).toBe(true);
    expect(isStale({ source: 'community', observedAt: '2026-09-11T11:30:00.000Z' }, now, 3600)).toBe(false);
  });

  it('TEST-A1-PROV-04: une provenance sans horodatage est considérée périmée', () => {
    const now = '2026-09-11T12:00:00.000Z';
    expect(isStale({ source: 'community', observedAt: '2026-09-11T11:00:00.000Z' }, now, 3600)).toBe(false);
    expect(isStale({ source: 'official', sourceRef: 'ref-1' }, now, 3600)).toBe(true);
    expect(isStale({ source: 'community', observedAt: 'date-invalide' }, now, 3600)).toBe(true);
  });
});

describe('Domaine noyau — contrat moteur (TEST-A1-ENG)', () => {
  it('TEST-A1-ENG-01: makeEngineResult applique les défauts et un computedAt ISO', () => {
    const before = Date.now();
    const result = makeEngineResult({ value: { days: 3 } });
    const after = Date.now();

    expect(result.value).toEqual({ days: 3 });
    expect(result.confidence).toEqual(COLD_CONFIDENCE);
    expect(result.provenance).toEqual([]);
    expect(result.assumptions).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.alternatives).toEqual([]);
    expect(result.impacts).toEqual([]);
    expect(result.validUntil).toBeUndefined();

    const parsed = Date.parse(result.computedAt);
    expect(Number.isNaN(parsed)).toBe(false);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it('TEST-A1-ENG-02: makeEngineResult conserve valeur, confiance, provenance et validité fournies', () => {
    const computedAt = '2026-09-11T10:00:00.000Z';
    const result = makeEngineResult({
      value: 42,
      confidence: makeConfidence({ score: 0.8, sampleCount: 5, method: 'm' }),
      provenance: [{ source: 'measured', observedAt: computedAt }],
      warnings: [{ code: 'W-1', message: 'Hypothèse fragile', severity: 'warning' }],
      computedAt,
      validUntil: '2026-09-11T12:00:00.000Z',
    });

    expect(result.confidence.score).toBe(0.8);
    expect(result.provenance).toHaveLength(1);
    expect(result.warnings[0].code).toBe('W-1');
    expect(result.computedAt).toBe(computedAt);
    expect(result.validUntil).toBe('2026-09-11T12:00:00.000Z');
  });

  it('TEST-A1-ENG-03: validateEngineResult accepte un résultat cohérent', () => {
    const result = makeEngineResult({
      value: 'ok',
      computedAt: '2026-09-11T10:00:00.000Z',
      validUntil: '2026-09-11T11:00:00.000Z',
    });
    expect(validateEngineResult(result)).toEqual([]);
  });

  it('TEST-A1-ENG-04: validateEngineResult signale score hors bornes et computedAt non ISO', () => {
    const result = makeEngineResult({
      value: 1,
      computedAt: 'pas-une-date',
      confidence: makeConfidence({ score: 0.5, sampleCount: 1, method: 'm' }),
    });
    const invalid = {
      ...result,
      confidence: { ...result.confidence, score: 1.2 },
    };
    const errors = validateEngineResult(invalid);

    expect(errors.some((e) => e.includes('score'))).toBe(true);
    expect(errors.some((e) => e.includes('computedAt'))).toBe(true);
  });

  it('TEST-A1-ENG-05: validateEngineResult rejette validUntil antérieur à computedAt', () => {
    const result = makeEngineResult({
      value: 1,
      computedAt: '2026-09-11T10:00:00.000Z',
      validUntil: '2026-09-11T09:00:00.000Z',
    });
    const errors = validateEngineResult(result);
    expect(errors.some((e) => e.includes('validUntil'))).toBe(true);
  });
});

describe('Domaine noyau — événements (TEST-A1-EVT)', () => {
  it('TEST-A1-EVT-01: ADVENTURE_DOMAIN_EVENT_TYPES liste la taxonomie du master plan', () => {
    expect(ADVENTURE_DOMAIN_EVENT_TYPES).toHaveLength(17);
    expect(ADVENTURE_DOMAIN_EVENT_TYPES).toContain('adventure.plan.generated');
    expect(ADVENTURE_DOMAIN_EVENT_TYPES).toContain('trail.report.created');
    expect(ADVENTURE_DOMAIN_EVENT_TYPES).toContain('decision.confirmation.required');
    expect(new Set(ADVENTURE_DOMAIN_EVENT_TYPES).size).toBe(ADVENTURE_DOMAIN_EVENT_TYPES.length);
  });

  it('TEST-A1-EVT-02: buildDomainEvent calcule la clé d’idempotence et les défauts', () => {
    const event = buildDomainEvent({
      type: 'trail.report.created',
      entityType: 'terrain_report',
      entityId: 'report-1',
      processorVersion: 'a1-v1',
    });

    expect(event.idempotencyKey).toBe('trail.report.created:report-1:a1-v1');
    expect(event.payload).toEqual({});
    expect(event.actorId).toBeUndefined();
    expect(Number.isNaN(Date.parse(event.createdAt))).toBe(false);
  });

  it('TEST-A1-EVT-03: la clé d’idempotence est stable et dépend de la version de traitement', () => {
    const base = {
      type: 'hike.completed' as const,
      entityType: 'hike_session',
      entityId: 'session-1',
    };
    const first = buildDomainEvent({ ...base, processorVersion: 'v1' });
    const second = buildDomainEvent({ ...base, processorVersion: 'v1' });
    const otherVersion = buildDomainEvent({ ...base, processorVersion: 'v2' });

    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(otherVersion.idempotencyKey).not.toBe(first.idempotencyKey);
  });
});
