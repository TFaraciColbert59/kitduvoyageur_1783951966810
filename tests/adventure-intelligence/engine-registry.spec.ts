import { describe, it, expect, vi } from 'vitest';
import {
  EngineRegistry,
  EngineSkipSignal,
  type EngineRunRecord,
} from '@/features/adventure-intelligence/domain/engineRegistry';
import {
  makeEngineResult,
  type AdventureEngine,
  type AdventureExecutionContext,
} from '@/features/adventure-intelligence/domain/engine';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';

const CONTEXT: AdventureExecutionContext = {
  userId: 'a6000000-0000-4000-8000-000000000001',
  nowIso: '2026-09-11T10:00:00.000Z',
};

type TestEngine = AdventureEngine<unknown, unknown>;

function engine(
  id: string,
  overrides: Partial<TestEngine> = {}
): TestEngine {
  return {
    id,
    version: 'a6-test',
    dependencies: [],
    canRun: () => true,
    run: async () => makeEngineResult({ value: { engine: id } }),
    ...overrides,
  };
}

describe('A6 — registre de moteurs (TEST-A6-REG)', () => {
  it('TEST-A6-REG-01: un canRun faux produit un skip motivé, sans exécution ni sortie', async () => {
    const run = vi.fn(async () => makeEngineResult({ value: 'jamais' }));
    const registry = new EngineRegistry();
    registry.register(
      Object.assign(engine('weather', { run, canRun: () => false }), {
        skipReason: {
          code: 'weather_no_deterministic_source',
          message: 'Aucune source météo déterministe — section laissée vide.',
          severity: 'warning' as const,
        },
      })
    );

    const result = await registry.runPipeline(CONTEXT, { text: 'test' }, () => undefined);

    expect(run).not.toHaveBeenCalled();
    expect(result.outputs.has('weather')).toBe(false);
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toMatchObject({
      engineId: 'weather',
      engineVersion: 'a6-test',
      status: 'skipped',
    });
    expect(result.runs[0].warnings[0].code).toBe('weather_no_deterministic_source');
    expect(Number.isFinite(result.runs[0].durationMs)).toBe(true);

    const signaled = new EngineRegistry();
    signaled.register(
      engine('regulations', {
        run: async () => {
          throw new EngineSkipSignal({
            code: 'regulations_no_source',
            message: 'Source réglementaire absente.',
            severity: 'warning',
          });
        },
      })
    );
    const signaledResult = await signaled.runPipeline(CONTEXT, {}, () => undefined);
    expect(signaledResult.runs[0].status).toBe('skipped');
    expect(signaledResult.runs[0].warnings[0].code).toBe('regulations_no_source');
  });

  it('TEST-A6-REG-02: un échec non critique est isolé et n’interrompt pas le pipeline', async () => {
    const registry = new EngineRegistry();
    registry.register(
      engine('weather', {
        canRun: () => true,
      })
    );
    registry.register(
      engine('regulations', {
        dependencies: ['weather'],
        run: async () => {
          throw new Error('source corrompue');
        },
      })
    );
    registry.register(engine('documents', { dependencies: ['regulations'] }));

    const result = await registry.runPipeline(CONTEXT, {}, () => undefined);
    const runs: EngineRunRecord[] = result.runs;
    const byId = new Map(runs.map((record) => [record.engineId, record]));

    expect(byId.get('regulations')?.status).toBe('failed');
    expect(byId.get('regulations')?.error).toContain('source corrompue');
    expect(byId.get('regulations')?.warnings[0].code).toBe('engine_failed');
    expect(byId.get('documents')?.status).toBe('succeeded');
    expect(result.outputs.has('documents')).toBe(true);
  });

  it('TEST-A6-REG-03: la confiance du plan est la combinaison prudente des moteurs ayant produit', async () => {
    const registry = new EngineRegistry();
    registry.register(
      engine('intent', {
        run: async () =>
          makeEngineResult({
            value: 'brief',
            confidence: makeConfidence({ score: 0.9, sampleCount: 2, method: 'a' }),
          }),
      })
    );
    registry.register(
      engine('route', {
        dependencies: ['intent'],
        run: async () =>
          makeEngineResult({
            value: 'route',
            confidence: makeConfidence({ score: 0.4, sampleCount: 3, method: 'b' }),
          }),
      })
    );

    const result = await registry.runPipeline(CONTEXT, {}, () => undefined);

    expect(result.planConfidence.score).toBe(0.4);
    expect(result.planConfidence.sampleCount).toBe(5);
    expect(result.planConfidence.method).toBe('combined:min');
  });

  it('TEST-A6-REG-04: les runs sont enregistrés dans l’ordre topologique avec version et durée', async () => {
    const registry = new EngineRegistry();
    registry.register(engine('route', { dependencies: ['intent'] }));
    registry.register(engine('intent'));

    const result = await registry.runPipeline(CONTEXT, { text: 'ok' }, () => undefined);

    expect(result.runs.map((record) => record.engineId)).toEqual(['intent', 'route']);
    for (const record of result.runs) {
      expect(record.engineVersion).toBe('a6-test');
      expect(record.status).toBe('succeeded');
      expect(record.durationMs).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(record.warnings)).toBe(true);
    }
    const intentOutput = result.outputs.get('intent') as { value: { engine: string } };
    expect(intentOutput.value).toEqual({ engine: 'intent' });
  });

  it('TEST-A6-REG-05: canRun reçoit le contexte et bloque l’exécution quand faux', async () => {
    const canRun = vi.fn(() => false);
    const run = vi.fn();
    const registry = new EngineRegistry();
    registry.register({
      id: 'weather',
      version: 'a6-test',
      dependencies: [],
      canRun,
      run: run as unknown as TestEngine['run'],
    });

    await registry.runPipeline(CONTEXT, {}, () => undefined);

    expect(canRun).toHaveBeenCalledWith(CONTEXT);
    expect(run).not.toHaveBeenCalled();
  });
});
