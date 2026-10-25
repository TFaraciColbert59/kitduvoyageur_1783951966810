import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCoveragePipeline } from '../../scripts/coverage/pipeline';
import { buildSamplingPlan, type SamplingChecklistEntry } from '../../scripts/coverage/sampling';

const FIXTURES = path.join(__dirname, 'fixtures');
const baseOptions = {
  manifestPath: path.join(FIXTURES, 'manifest.json'),
  licensesPath: path.join(FIXTURES, 'licenses.json'),
  routesPath: path.join(FIXTURES, 'routes.geojson'),
  poisPath: path.join(FIXTURES, 'pois.json'),
  segmentsPath: path.join(FIXTURES, 'segments.json'),
  thresholdsPath: path.join(FIXTURES, 'thresholds.json'),
  now: new Date('2026-09-12T00:00:00.000Z'),
};

describe('Phase 4 — pipeline complet (11 étapes, dry-run)', () => {
  it('exécute les 11 étapes sans réseau ni écriture', () => {
    const run = runCoveragePipeline({
      ...baseOptions,
      flagsPath: path.join(FIXTURES, 'flags-off.json'),
    });

    expect(run.summary.dryRun).toBe(true);
    expect(run.steps.map((step) => step.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(run.summary.routesNormalized).toBe(3);
    expect(run.summary.routesValid).toBe(3);
    expect(run.summary.duplicates).toBe(0);
    expect(run.summary.metricsComputed).toBe(3);
    expect(run.summary.segmentsAttached).toBe(1);
    expect(run.poiSplit?.geographic.length).toBe(2);
    expect(run.poiSplit?.hasAffiliateLink).toBe(true);
    expect(run.publication?.allowed).toBe(false);
    expect(run.summary.available).toBe(false);
  });

  it('n’expose jamais une publication autorisée avec le flag par défaut', () => {
    const run = runCoveragePipeline(baseOptions);
    expect(run.publication).not.toBeNull();
    expect(run.publication?.featureFlag.enabled).toBe(false);
    expect(run.publication?.allowed).toBe(false);
  });

  it('prépare la publication uniquement avec flag activé et échantillonnage humain complet', () => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'lkdv-phase4-'));
    try {
      // 25 parcours distincts : le gate exige 20 échantillons humains.
      const features = Array.from({ length: 25 }, (_, index) => ({
        type: 'Feature',
        properties: { id: `route-${index}`, name: `Parcours ${index}`, source: 'fixture' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [6 + index * 0.01, 45 + index * 0.01],
            [6.01 + index * 0.01, 45.01 + index * 0.01],
          ],
        },
      }));
      const routesPath = path.join(temporary, 'routes.json');
      writeFileSync(
        routesPath,
        JSON.stringify({ type: 'FeatureCollection', features }),
        'utf8'
      );

      const plan = buildSamplingPlan(
        features.map((feature) => ({
          externalId: feature.properties.id,
          name: feature.properties.name,
          source: 'fixture',
          points: feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
          tags: {},
        })),
        { seed: 'fixture-dataset@2026.09.1' }
      );
      const checklist: SamplingChecklistEntry[] = plan.entries.map((entry) => ({
        routeKey: entry.routeKey,
        reviewer: 'relecteur-humain',
        reviewedAt: '2026-09-10T00:00:00.000Z',
        verdict: 'ok',
      }));
      const samplingPath = path.join(temporary, 'sampling.json');
      writeFileSync(samplingPath, JSON.stringify(checklist), 'utf8');

      const run = runCoveragePipeline({
        ...baseOptions,
        routesPath,
        samplingPath,
        flagsPath: path.join(FIXTURES, 'flags-on.json'),
      });

      expect(run.summary.available).toBe(true);
      expect(run.publication?.allowed).toBe(true);
      expect(run.steps[10].status).toBe('ok');
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('refuse dès l’étape 2 sans licence enregistrée', () => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'lkdv-phase4-'));
    try {
      const licensesPath = path.join(temporary, 'licenses.json');
      writeFileSync(licensesPath, JSON.stringify({ licenses: [] }), 'utf8');
      const run = runCoveragePipeline({
        ...baseOptions,
        licensesPath,
        flagsPath: path.join(FIXTURES, 'flags-off.json'),
      });
      expect(run.summary.refused).toBe(true);
      expect(run.summary.refusedAtStep).toBe(2);
      expect(run.gate?.allowed).toBe(false);
      expect(run.steps.length).toBe(2);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('refuse toute exécution non dry-run (écriture = décision humaine)', () => {
    const run = runCoveragePipeline({ ...baseOptions, dryRun: false });
    expect(run.summary.refused).toBe(true);
    expect(run.summary.refusedAtStep).toBe(0);
    expect(run.steps[0].detail).toContain('décision humaine');
  });
});
