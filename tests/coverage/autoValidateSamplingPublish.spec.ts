import { describe, it, expect } from 'vitest';
import {
  buildSamplingPlan,
  evaluateSampling,
  REQUIRED_SAMPLES,
  type SamplingChecklistEntry,
} from '../../scripts/coverage/sampling';
import { evaluateAutoValidation } from '../../scripts/coverage/autoValidate';
import { buildPublicationPlan, PUBLICATION_FLAG_ID } from '../../scripts/coverage/publishPlan';
import type {
  DatasetQualityMetrics,
  LicenseRecord,
  NormalizedRoute,
  QualityThresholds,
} from '../../scripts/coverage/types';

const NOW = new Date('2026-09-12T00:00:00.000Z');

const thresholds: QualityThresholds = {
  minValidGeometries: 2,
  minSourcedPois: 2,
  minSampledRoutes: 20,
  maxUnjustifiedBreaks: 0,
};

const metrics: DatasetQualityMetrics = {
  totalFeatures: 3,
  validGeometries: 3,
  invalidGeometries: 0,
  unjustifiedBreaks: 0,
  sourcedPois: 2,
  sampledRoutes: 20,
};

const license: LicenseRecord = {
  code: 'FIXTURE-OPEN-1.0',
  name: 'Licence test',
  status: 'active',
  allowsRedistribution: true,
  allowsCommercialUse: true,
  shareAlike: false,
  evidenceUrl: 'https://example.invalid',
  evidenceNote: null,
  validUntil: null,
};

function makeRoutes(count: number): NormalizedRoute[] {
  return Array.from({ length: count }, (_, index) => ({
    externalId: `route-${index}`,
    name: `Parcours ${index}`,
    source: 'fixture',
    points: [
      { lat: 45 + index * 0.001, lng: 6 + index * 0.001 },
      { lat: 45.01 + index * 0.001, lng: 6.01 + index * 0.001 },
    ],
    tags: {},
  }));
}

describe('Phase 4 — validation automatique (étape 9)', () => {
  it('passe quand licence, seuils et métriques sont satisfaits', () => {
    const result = evaluateAutoValidation({ metrics, thresholds, license, now: NOW });
    expect(result.passed).toBe(true);
    expect(result.canPublish).toBe(true);
  });

  it('peut différer l’échantillonnage humain (étape 9) puis l’exiger (étape 10)', () => {
    const pending = evaluateAutoValidation({
      metrics: { ...metrics, sampledRoutes: 0 },
      thresholds,
      license,
      now: NOW,
      requireSampling: false,
    });
    expect(pending.passed).toBe(true);

    const required = evaluateAutoValidation({
      metrics: { ...metrics, sampledRoutes: 0 },
      thresholds,
      license,
      now: NOW,
      requireSampling: true,
    });
    expect(required.passed).toBe(false);
    expect(required.failures.join(' ')).toContain('échantillonnés');
  });

  it('refuse sans licence enregistrée', () => {
    const result = evaluateAutoValidation({ metrics, thresholds, license: null, now: NOW });
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('licence');
  });

  it('refuse une licence sans redistribution', () => {
    const result = evaluateAutoValidation({
      metrics,
      thresholds,
      license: { ...license, allowsRedistribution: false },
      now: NOW,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('redistribution');
  });

  it('refuse un seuil d’échantillonnage inférieur au gate de 20', () => {
    const result = evaluateAutoValidation({
      metrics,
      thresholds: { ...thresholds, minSampledRoutes: 19 },
      license,
      now: NOW,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('gate');
  });

  it('refuse des métriques sous les seuils', () => {
    const result = evaluateAutoValidation({
      metrics: { ...metrics, validGeometries: 1, sourcedPois: 0, sampledRoutes: 5, unjustifiedBreaks: 3 },
      thresholds,
      license,
      now: NOW,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBe(4);
  });
});

describe('Phase 4 — échantillonnage humain (étape 10)', () => {
  it('planifie 20 parcours de façon déterministe quand le catalogue le permet', () => {
    const routes = makeRoutes(30);
    const first = buildSamplingPlan(routes, { seed: 'graine' });
    const second = buildSamplingPlan(routes, { seed: 'graine' });
    expect(first.entries.length).toBe(REQUIRED_SAMPLES);
    expect(first.entries).toEqual(second.entries);
    expect(first.achievable).toBe(true);
  });

  it('signale un catalogue trop petit pour le gate', () => {
    const plan = buildSamplingPlan(makeRoutes(5), { seed: 'graine' });
    expect(plan.entries.length).toBe(5);
    expect(plan.achievable).toBe(false);
  });

  it('valide une checklist complète de 20 verdicts OK', () => {
    const plan = buildSamplingPlan(makeRoutes(30), { seed: 'graine' });
    const checklist: SamplingChecklistEntry[] = plan.entries.map((entry) => ({
      routeKey: entry.routeKey,
      reviewer: 'relecteur-humain',
      reviewedAt: '2026-09-10T00:00:00.000Z',
      verdict: 'ok',
    }));
    const evaluation = evaluateSampling(checklist, plan);
    expect(evaluation.complete).toBe(true);
    expect(evaluation.okCount).toBe(20);
    expect(evaluation.failures).toEqual([]);
  });

  it('refuse un verdict « problème », un relecteur manquant ou un doublon', () => {
    const plan = buildSamplingPlan(makeRoutes(30), { seed: 'graine' });
    const checklist: SamplingChecklistEntry[] = plan.entries.map((entry, index) => ({
      routeKey: entry.routeKey,
      reviewer: index === 1 ? '   ' : 'relecteur',
      reviewedAt: '2026-09-10T00:00:00.000Z',
      verdict: index === 2 ? 'problem' : 'ok',
    }));
    checklist.push({ ...checklist[0] });
    const evaluation = evaluateSampling(checklist, plan);
    expect(evaluation.complete).toBe(false);
    expect(evaluation.failures.some((failure) => failure.includes('sans relecteur'))).toBe(true);
    expect(evaluation.failures.some((failure) => failure.includes('signalé'))).toBe(true);
    expect(evaluation.failures.some((failure) => failure.includes('plusieurs fois'))).toBe(true);
  });
});

describe('Phase 4 — publication sous feature flag (étape 11)', () => {
  const plan = buildSamplingPlan(makeRoutes(30), { seed: 'graine' });
  const checklist: SamplingChecklistEntry[] = plan.entries.map((entry) => ({
    routeKey: entry.routeKey,
    reviewer: 'relecteur-humain',
    reviewedAt: '2026-09-10T00:00:00.000Z',
    verdict: 'ok',
  }));
  const sampling = evaluateSampling(checklist, plan);
  const validation = evaluateAutoValidation({ metrics, thresholds, license, now: NOW });

  const baseInput = {
    datasetKey: 'fixture-dataset',
    version: '2026.09.1',
    countryIsoA2: 'FR',
    regionCode: 'FIXTURE-REGION',
    sourceName: 'Source test',
    licenseCode: license.code,
    pipelineVersion: 'phase4-1.0.0',
    importActor: 'fixture-agent',
    metrics,
    thresholds,
    validation,
    sampling,
  };

  it('refuse la publication quand le flag est désactivé (défaut)', () => {
    const publication = buildPublicationPlan({
      ...baseInput,
      flags: { [PUBLICATION_FLAG_ID]: false },
    });
    expect(publication.allowed).toBe(false);
    expect(publication.blockedReasons.join(' ')).toContain('désactivé');
    expect(publication.dryRun).toBe(true);
  });

  it('prépare un plan SQL sans l’exécuter quand tous les gates passent et le flag est activé', () => {
    const publication = buildPublicationPlan({
      ...baseInput,
      flags: { [PUBLICATION_FLAG_ID]: true },
    });
    expect(publication.allowed).toBe(true);
    expect(publication.blockedReasons).toEqual([]);
    expect(publication.sql.join('\n')).toContain('coverage_datasets');
    expect(publication.sql.join('\n')).toContain(`'validated'`);
    expect(publication.dryRun).toBe(true);
  });

  it('refuse la publication si l’échantillonnage est incomplet, même flag activé', () => {
    const publication = buildPublicationPlan({
      ...baseInput,
      flags: { [PUBLICATION_FLAG_ID]: true },
      sampling: { complete: false, okCount: 3, failures: ['manquant'] },
    });
    expect(publication.allowed).toBe(false);
    expect(publication.blockedReasons.join(' ')).toContain('Échantillonnage');
  });
});
