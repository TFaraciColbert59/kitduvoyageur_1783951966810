import { describe, it, expect, vi } from 'vitest';
import {
  generateAdventure,
  type AdventureEnginePersistence,
  type AdventurePlanBundle,
} from '@/features/adventure-intelligence/server/generateAdventure';
import { createDefaultRegistry } from '@/features/adventure-intelligence/server/adapters';
import { ADVENTURE_PLAN_SECTION_KEYS } from '@/features/adventure-intelligence/domain/adventurePlan';
import { adventurePlanSchema } from '@/features/adventure-intelligence/schemas/adventurePlan.schema';

const OWNER_ID = 'a6000000-0000-4000-8000-0000000000dd';
const PLAN_ID = 'a6000000-0000-4000-8000-0000000000ee';
const NOW = '2026-09-11T10:00:00.000Z';
const TEXT = 'Trek de 7 jours au Tour du Mont-Blanc en juillet en refuge avec un budget de 800 €';

function makePersistence(options: { bundleError?: Error } = {}) {
  const plans: Record<string, unknown>[] = [];
  const versions: Record<string, unknown>[] = [];
  const runs: Record<string, unknown>[] = [];
  const decisions: Record<string, unknown>[] = [];

  const persistence: AdventureEnginePersistence = {
    persistPlanBundle: vi.fn(async (bundle: AdventurePlanBundle) => {
      // Transaction simulée : un échec n'écrit rien du tout.
      if (options.bundleError) throw options.bundleError;
      // La RPC réimpose le plan_id persisté à toutes les lignes filles.
      plans.push(bundle.plan);
      versions.push({ ...bundle.version, plan_id: PLAN_ID });
      runs.push(...bundle.runs.map((row) => ({ ...row, plan_id: PLAN_ID })));
      decisions.push(
        ...(bundle.decisions as Record<string, unknown>[]).map((row) => ({
          ...row,
          plan_id: PLAN_ID,
        }))
      );
      return { id: PLAN_ID };
    }),
    insertEngineRun: vi.fn(async (row: unknown) => {
      runs.push(row as Record<string, unknown>);
    }),
  };

  return { persistence, plans, versions, runs, decisions };
}

function deps(
  persistence: AdventureEnginePersistence,
  overrides: Partial<Parameters<typeof generateAdventure>[1]> = {}
): Parameters<typeof generateAdventure>[1] {
  return {
    registry: createDefaultRegistry(),
    persistence,
    ...overrides,
  };
}

describe('A6 — orchestrateur de génération (TEST-A6-GEN)', () => {
  it('TEST-A6-GEN-01: une phrase produit un plan complet et valide, version 1 persistée', async () => {
    const { persistence, versions } = makePersistence();

    const result = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      deps(persistence)
    );

    for (const key of ADVENTURE_PLAN_SECTION_KEYS) {
      expect(result.plan.sections).toHaveProperty(key);
    }
    expect(result.plan.sections.dailyStages).not.toBeNull();
    expect(result.plan.sections.budget).not.toBeNull();
    expect(result.plan.sections.gearPlan).not.toBeNull();
    expect(result.plan.sections.safetyPlan).not.toBeNull();
    expect(result.plan.sections.personalDifficulty).not.toBeNull();
    expect(result.plan.sections.paceStrategies).not.toBeNull();
    expect(result.plan.sections.regulations).toBeNull();
    expect(result.plan.sections.documents).toBeNull();
    expect(result.plan.sections.liveConditions).toBeNull();

    expect(result.plan.id).toBe(PLAN_ID);
    expect(result.plan.ownerId).toBe(OWNER_ID);
    expect(result.plan.currentVersion).toBe(1);
    expect(result.plan.status).toBe('draft');
    expect(result.plan.destinations.length).toBeGreaterThan(0);

    const parsed = adventurePlanSchema.safeParse(result.plan);
    expect(parsed.success).toBe(true);

    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ plan_id: PLAN_ID, version: 1 });
    expect((versions[0].snapshot as { id: string }).id).toBe(PLAN_ID);
  });

  it('TEST-A6-GEN-02: chaque section calculée porte provenance, confiance et horodatage', async () => {
    const { persistence } = makePersistence();
    const result = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      deps(persistence)
    );

    const sections = Object.entries(result.plan.sections);
    const computed = sections.filter(([, section]) => section !== null);
    expect(computed.length).toBeGreaterThanOrEqual(10);

    for (const [key, section] of computed) {
      expect(section, key).not.toBeNull();
      const value = section as NonNullable<typeof section>;
      expect(value.provenance.length, key).toBeGreaterThan(0);
      expect(value.confidence.score, key).toBeGreaterThanOrEqual(0);
      expect(value.confidence.score, key).toBeLessThanOrEqual(1);
      expect(Number.isNaN(Date.parse(value.computedAt)), key).toBe(false);
      expect(Array.isArray(value.warnings), key).toBe(true);
    }

    expect(result.plan.confidence.method).toBe('combined:min');
    expect(result.plan.confidence.score).toBeGreaterThanOrEqual(0);
  });

  it('TEST-A6-GEN-03: trois candidats sont produits avec leurs variantes', async () => {
    const { persistence } = makePersistence();
    const result = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      deps(persistence)
    );

    expect(result.candidates.map((candidate) => candidate.id)).toEqual([
      'comfort',
      'balanced',
      'adventure',
    ]);
    expect(result.plan.sections.alternatives).not.toBeNull();
  });

  it('TEST-A6-GEN-04: les décisions requises et les runs sont persistés', async () => {
    const { persistence, runs, decisions } = makePersistence();
    const result = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      deps(persistence)
    );

    expect(runs.length).toBeGreaterThan(0);
    expect(runs.map((run) => run.engine_id)).toContain('intent');
    expect(runs.some((run) => run.status === 'skipped')).toBe(true);
    expect(runs.some((run) => run.status === 'succeeded')).toBe(true);
    expect(runs.every((run) => typeof run.duration_ms === 'number')).toBe(true);

    expect(decisions.length).toBeGreaterThan(0);
    expect(
      decisions.some(
        (decision) => decision.decision_type === 'payment' && decision.requires_confirmation === true
      )
    ).toBe(true);
    expect(
      decisions.some(
        (decision) =>
          decision.decision_type === 'safety_change' && decision.requires_confirmation === true
      )
    ).toBe(true);
    expect(result.runs.some((run) => run.engineId === 'weather' && run.status === 'skipped')).toBe(
      true
    );
  });

  it('TEST-A6-GEN-05: l’échec de explain ne bloque jamais le plan (aiUsed=false)', async () => {
    const { persistence } = makePersistence();
    const explain = vi.fn(async () => {
      throw new Error('fournisseur IA indisponible');
    });

    const result = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      deps(persistence, { explain })
    );

    expect(explain).toHaveBeenCalledTimes(1);
    expect(result.aiUsed).toBe(false);
    expect(result.explanation.trim().length).toBeGreaterThan(0);
    expect(result.plan.sections.budget).not.toBeNull();

    const withoutExplain = makePersistence();
    const noAi = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      deps(withoutExplain.persistence)
    );
    expect(noAi.aiUsed).toBe(false);
    expect(noAi.explanation.trim().length).toBeGreaterThan(0);

    const withAi = makePersistence();
    const ai = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      deps(withAi.persistence, {
        explain: async () => 'Résumé IA du plan.',
      })
    );
    expect(ai.aiUsed).toBe(true);
    expect(ai.explanation).toBe('Résumé IA du plan.');
  });
});

describe('A10 — Bundle de plan transactionnel (TEST-A10-TX)', () => {
  it('TEST-A10-TX-05: un échec du bundle ne laisse aucun plan partiel', async () => {
    const { persistence, plans, versions, runs, decisions } = makePersistence({
      bundleError: new Error('bundle indisponible'),
    });

    await expect(
      generateAdventure({ ownerId: OWNER_ID, text: TEXT, now: NOW }, deps(persistence))
    ).rejects.toThrow('bundle indisponible');

    expect(plans).toHaveLength(0);
    expect(versions).toHaveLength(0);
    expect(runs).toHaveLength(0);
    expect(decisions).toHaveLength(0);
  });

  it('TEST-A10-TX-06: plan, version, runs et décisions partent dans un seul appel', async () => {
    const { persistence } = makePersistence();

    const result = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      deps(persistence)
    );

    expect(persistence.persistPlanBundle).toHaveBeenCalledTimes(1);
    expect(persistence.insertEngineRun).not.toHaveBeenCalled();

    const bundle = vi.mocked(persistence.persistPlanBundle).mock.calls[0][0];
    expect(bundle.plan).toMatchObject({ owner_id: OWNER_ID, current_version: 1 });
    expect(bundle.version).toMatchObject({ plan_id: bundle.plan.id, version: 1 });
    expect(bundle.runs.length).toBeGreaterThan(0);
    expect(bundle.decisions.length).toBeGreaterThan(0);
    expect(bundle.runs.every((row) => row.plan_id === bundle.plan.id)).toBe(true);
    expect(bundle.decisions.every((row) => row.plan_id === bundle.plan.id)).toBe(true);
    expect(result.plan.id).toBe(PLAN_ID);
  });
});
