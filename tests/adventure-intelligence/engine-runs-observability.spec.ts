import { describe, it, expect, vi } from 'vitest';
import {
  ADVENTURE_PIPELINE_VERSION,
  FALLBACK_WARNING_CODES,
  generateAdventure,
  type AdventureEnginePersistence,
  type AdventurePlanBundle,
} from '@/features/adventure-intelligence/server/generateAdventure';
import { createDefaultRegistry } from '@/features/adventure-intelligence/server/adapters';
import { EngineRegistry } from '@/features/adventure-intelligence/domain/engineRegistry';

const OWNER_ID = 'a11a11a1-0000-4000-8000-000000000001';
const PLAN_ID = 'a11a11a1-0000-4000-8000-0000000000ee';
const NOW = '2026-09-11T10:00:00.000Z';
const TEXT = 'Trek de 7 jours au Tour du Mont-Blanc en juillet en refuge avec un budget de 800 €';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makePersistence() {
  const runs: Record<string, unknown>[] = [];
  const persistence: AdventureEnginePersistence = {
    persistPlanBundle: vi.fn(async (bundle: AdventurePlanBundle) => {
      runs.push(...bundle.runs);
      return { id: PLAN_ID };
    }),
    insertEngineRun: vi.fn(async (row: unknown) => {
      runs.push(row as Record<string, unknown>);
    }),
  };
  return { persistence, runs };
}

function deps(
  persistence: AdventureEnginePersistence,
  registry = createDefaultRegistry()
): Parameters<typeof generateAdventure>[1] {
  return {
    registry,
    persistence,
    hasActiveConsent: async () => false,
    getCurrentProfile: async () => null,
    persistAdventurePredictions: async () => {},
  };
}

describe('A11 — observabilité des runs de moteurs (TEST-A11-OBS)', () => {
  it('TEST-A11-OBS-01: un corridor de corrélation unique est propagé à tous les runs', async () => {
    const { persistence, runs } = makePersistence();
    await generateAdventure({ ownerId: OWNER_ID, text: TEXT, now: NOW }, deps(persistence));

    expect(runs.length).toBeGreaterThan(0);
    const correlations = new Set(runs.map((row) => row.correlation_id));
    expect(correlations.size).toBe(1);
    const correlationId = [...correlations][0];
    expect(typeof correlationId).toBe('string');
    expect(correlationId).toMatch(UUID_PATTERN);

    // Chemin orphelin : pipeline critique en échec ⇒ insertEngineRun corrélé.
    const failing = new EngineRegistry();
    failing.register({
      id: 'route',
      version: 'a11-test',
      dependencies: [],
      canRun: () => true,
      run: async () => {
        throw new Error('route indisponible');
      },
    });
    const orphan = makePersistence();
    await expect(
      generateAdventure({ ownerId: OWNER_ID, text: TEXT, now: NOW }, deps(orphan.persistence, failing))
    ).rejects.toThrow('route indisponible');

    expect(orphan.persistence.insertEngineRun).toHaveBeenCalled();
    for (const row of orphan.runs) {
      expect(row.correlation_id).toMatch(UUID_PATTERN);
    }
  });

  it('TEST-A11-OBS-02: timestamps réels distincts pour les moteurs exécutés', async () => {
    const before = Date.now();
    const { persistence, runs } = makePersistence();
    await generateAdventure({ ownerId: OWNER_ID, text: TEXT, now: NOW }, deps(persistence));
    const after = Date.now();

    expect(runs.length).toBeGreaterThan(0);
    for (const row of runs) {
      const started = Date.parse(String(row.started_at));
      const finished = Date.parse(String(row.finished_at));
      expect(Number.isNaN(started)).toBe(false);
      expect(Number.isNaN(finished)).toBe(false);
      expect(started).toBeGreaterThanOrEqual(before - 1000);
      expect(finished).toBeLessThanOrEqual(after + 1000);
      expect(finished).toBeGreaterThanOrEqual(started);
      if (row.status !== 'skipped') {
        expect(finished).toBeGreaterThan(started);
      }
    }
  });

  it('TEST-A11-OBS-03: pipeline_version et comptage des replis journalisés', async () => {
    const { persistence, runs } = makePersistence();
    await generateAdventure({ ownerId: OWNER_ID, text: TEXT, now: NOW }, deps(persistence));

    expect(FALLBACK_WARNING_CODES).toContain('cold_profile');
    for (const row of runs) {
      expect(row.pipeline_version).toBe(ADVENTURE_PIPELINE_VERSION);
      expect(ADVENTURE_PIPELINE_VERSION).toBe('a11-v1');
      expect(row.external_calls).toEqual([]);
      expect(Number.isInteger(row.fallback_count)).toBe(true);
      expect(Number(row.fallback_count)).toBeGreaterThanOrEqual(0);
      const warningCodes = new Set(
        (row.warnings as { code: string }[]).map((warning) => warning.code)
      );
      const expected = FALLBACK_WARNING_CODES.filter((code) => warningCodes.has(code)).length;
      expect(row.fallback_count).toBe(expected);
    }
  });
});
