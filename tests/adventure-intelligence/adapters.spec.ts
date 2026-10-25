import { describe, it, expect } from 'vitest';
import type { Proposal, TripBrief } from '@/features/trips/schemas/autoGen.schema';
import type { AdventureExecutionContext } from '@/features/adventure-intelligence/domain/engine';
import { EngineSkipSignal } from '@/features/adventure-intelligence/domain/engineRegistry';
import { intentAdapter } from '@/features/adventure-intelligence/server/adapters/intentAdapter';
import { routeAdapter, type RouteAdapterOutput } from '@/features/adventure-intelligence/server/adapters/routeAdapter';
import { budgetAdapter } from '@/features/adventure-intelligence/server/adapters/budgetAdapter';
import { gearAdapter } from '@/features/adventure-intelligence/server/adapters/gearAdapter';
import { coherenceAdapter } from '@/features/adventure-intelligence/server/adapters/coherenceAdapter';
import { predictionAdapter } from '@/features/adventure-intelligence/server/adapters/predictionAdapter';
import { difficultyAdapter } from '@/features/adventure-intelligence/server/adapters/difficultyAdapter';
import { safetyAdapter } from '@/features/adventure-intelligence/server/adapters/safetyAdapter';
import { weatherAdapter } from '@/features/adventure-intelligence/server/adapters/weatherAdapter';
import { regulationsAdapter, documentsAdapter } from '@/features/adventure-intelligence/server/adapters/skippedAdapters';

const CONTEXT: AdventureExecutionContext = {
  userId: 'a6000000-0000-4000-8000-000000000001',
  nowIso: '2026-09-11T10:00:00.000Z',
};

function proposal<T>(
  id: string,
  layer: string,
  value: T,
  options: { confidence?: 'high' | 'medium' | 'low'; alternatives?: Proposal<T>[]; locked?: boolean } = {}
): Proposal<T> {
  return {
    id,
    layer: layer as Proposal['layer'],
    slotId: `slot-${id}`,
    value,
    provenance: { source: 'estimated', sourceRef: 'Catalogue de référence LKDV (estimation)' },
    confidence: options.confidence ?? 'low',
    rationale: 'test',
    alternatives: options.alternatives ?? [],
    locked: options.locked ?? false,
    editedByUser: false,
    impacts: [],
  };
}

function routeOutput(overrides: Partial<RouteAdapterOutput> = {}): RouteAdapterOutput {
  const brief = {
    rawInput: 'trek test',
    destinations: { value: [{ country: 'FR', region: 'Massif du Sancy' }], confidence: 'stated' },
    duration: { value: { days: 4, flexible: false }, confidence: 'stated' },
    window: { value: { month: 7 }, confidence: 'defaulted' },
    party: { value: { adults: 2, minors: 0 }, confidence: 'stated' },
    budget: { value: { totalEur: 2000, tier: 'moderate' }, confidence: 'stated' },
    style: { value: ['hiking'], confidence: 'stated' },
    intensity: { value: { dailyKmMax: 20, dailyGainMax: 800, restEvery: 4 }, confidence: 'defaulted' },
    constraints: { value: [], confidence: 'defaulted' },
    mobility: { value: { modes: ['foot'], ownsVehicle: false, licence: false }, confidence: 'defaulted' },
    departure: { value: {}, confidence: 'defaulted' },
    fromProfile: { ownedGear: [], pastTrips: [], crews: [], units: 'metric', homeAirports: ['PAR'] },
  } as TripBrief;

  return {
    blueprintId: 'bp-test',
    layers: {
      itinerary: proposal('prop-itin-test', 'itinerary', {
        totalDistanceKm: 60,
        totalGainM: 2400,
        totalLossM: 2400,
        stagesCount: 4,
        difficulty: 'moderate',
      }),
      budget: proposal('prop-budg-test', 'budget', {
        totalPerPersonEur: 800,
        dailyAverageEur: 200,
        currency: 'EUR',
      }),
      accommodations: proposal(
        'prop-accom-test',
        'accommodations',
        { name: 'Refuge cher', priceEur: 3000 },
        { alternatives: [proposal('prop-accom-alt', 'accommodations', { name: 'Bivouac', priceEur: 0 })] }
      ),
      safety: proposal('prop-safe-test', 'safety', {
        rescuePhone: '112',
        rescueUnit: 'PGM Le Mont-Dore',
      }),
      food_water: proposal('prop-food-test', 'food_water', { resupplyEveryDays: 2 }),
      kit: proposal('prop-kit-test', 'kit', { targetWeightKg: 7.2, packVolumeL: 40 }),
    },
    tradeoffsLog: [],
    executionTimeMs: 1,
    brief,
    ...overrides,
  };
}

describe('A6 — adaptateurs des moteurs existants (TEST-A6-ADP)', () => {
  it('TEST-A6-ADP-01: intentAdapter extrait l’intention avec confiance et provenance', async () => {
    const result = await intentAdapter.run(
      { text: 'Trek de 7 jours au Tour du Mont-Blanc en juillet en refuge' },
      CONTEXT
    );

    expect(result.value.destinations.value[0]).toMatchObject({ country: 'FR' });
    expect(result.value.duration.value.days).toBe(7);
    expect(result.value.style.value).toContain('trekking');
    expect(result.provenance.length).toBeGreaterThan(0);
    expect(result.provenance[0].source).toBe('computed');
    expect(result.confidence.score).toBeGreaterThan(0.5);
    expect(result.computedAt).toBe(CONTEXT.nowIso);
    expect(result.warnings).toEqual([]);
  });

  it('TEST-A6-ADP-02: routeAdapter enveloppe le pipeline blueprints sans invention', async () => {
    const result = await routeAdapter.run(
      { text: 'Trek de 7 jours au Tour du Mont-Blanc en refuge' },
      CONTEXT
    );

    expect(result.value.blueprintId.length).toBeGreaterThan(0);
    expect(Object.keys(result.value.layers).length).toBeGreaterThan(0);
    expect(result.value.brief.rawInput).toContain('Mont-Blanc');
    expect(result.provenance.length).toBeGreaterThan(0);
    expect(result.confidence.score).toBeLessThanOrEqual(0.8);
    expect(result.computedAt).toBe(CONTEXT.nowIso);
  });

  it('TEST-A6-ADP-03: budgetAdapter calcule le budget via le moteur existant, sinon skip motivé', async () => {
    const result = await budgetAdapter.run(
      { route: routeOutput(), participantsCount: 2 },
      CONTEXT
    );

    expect(result.value.perPersonEur).toBe(800);
    expect(result.value.totalEur).toBe(1600);
    expect(result.value.currency).toBe('EUR');
    expect(result.value.summary.estimatedBudget).toBe(1600);
    expect(result.provenance.length).toBeGreaterThan(0);

    const withoutBudget = routeOutput({
      layers: { itinerary: routeOutput().layers.itinerary },
    });
    await expect(budgetAdapter.run({ route: withoutBudget }, CONTEXT)).rejects.toBeInstanceOf(
      EngineSkipSignal
    );
  });

  it('TEST-A6-ADP-04: gearAdapter produit l’analyse du kit contextuel', async () => {
    const result = await gearAdapter.run({ route: routeOutput() }, CONTEXT);

    expect(result.value.gearGaps.length).toBeGreaterThan(0);
    expect(result.value.maxAltitudeM).toBeGreaterThanOrEqual(0);
    expect(result.provenance[0].source).toBe('computed');
    expect(result.warnings.some((warning) => warning.code === 'inventory_missing')).toBe(true);
  });

  it('TEST-A6-ADP-05: coherenceAdapter arbitre et respecte les verrous sans violation silencieuse', async () => {
    const unlocked = await coherenceAdapter.run({ route: routeOutput() }, CONTEXT);
    const swapped = unlocked.value.resolvedLayers.accommodations as Proposal<{ priceEur: number }>;
    expect(swapped.value.priceEur).toBe(0);
    expect(unlocked.value.tradeoffsLog.length).toBeGreaterThan(0);
    expect(unlocked.value.lockReport.violations).toEqual([]);

    const locked = await coherenceAdapter.run(
      {
        route: routeOutput(),
        locks: [
          {
            id: 'accommodations',
            kind: 'hard',
            label: 'Hébergement imposé',
            value: { name: 'Refuge cher' },
            locked: true,
            source: 'user',
          },
        ],
      },
      CONTEXT
    );
    const kept = locked.value.resolvedLayers.accommodations as Proposal<{ priceEur: number }>;
    expect(kept.value.priceEur).toBe(3000);
    expect(locked.value.lockReport.before.length).toBe(1);
    expect(locked.value.lockReport.after.length).toBe(1);
    expect(locked.value.lockReport.violations).toEqual([]);
  });

  it('TEST-A6-ADP-06: predictionAdapter prédit les trois stratégies en repli standard', async () => {
    const result = await predictionAdapter.run({ route: routeOutput() }, CONTEXT);

    expect(result.value.strategies.map((strategy) => strategy.strategy)).toEqual([
      'comfort',
      'recommended',
      'fast',
    ]);
    expect(result.value.primary.strategy).toBe('recommended');
    for (const strategy of result.value.strategies) {
      expect(strategy.totalDurationP50Seconds).toBeLessThanOrEqual(
        strategy.totalDurationP90Seconds
      );
    }
    expect(result.value.segmentation).toBe('uniform_from_blueprint');
    expect(result.assumptions.some((assumption) => assumption.id === 'uniform_segmentation')).toBe(true);
  });

  it('TEST-A6-ADP-07: difficultyAdapter agrège la difficulté personnelle et groupe', async () => {
    const solo = await difficultyAdapter.run(
      { route: routeOutput(), participantsCount: 1 },
      CONTEXT
    );
    expect(solo.value.personalDifficulty).toBeGreaterThanOrEqual(0);
    expect(solo.value.personalDifficulty).toBeLessThanOrEqual(100);
    expect(solo.value.segmentCount).toBe(4);
    expect(solo.value.groupDifficulty).toBe(solo.value.personalDifficulty);

    const group = await difficultyAdapter.run(
      { route: routeOutput(), participantsCount: 3 },
      CONTEXT
    );
    expect(group.value.groupDifficulty).toBeNull();
    expect(group.warnings.some((warning) => warning.code === 'group_profiles_missing')).toBe(true);
  });

  it('TEST-A6-ADP-08: safetyAdapter expose les données du blueprint, regulations/documents skippent', async () => {
    const safety = await safetyAdapter.run({ route: routeOutput() }, CONTEXT);
    expect(safety.value).toMatchObject({ rescuePhone: '112', rescueUnit: 'PGM Le Mont-Dore' });
    expect(safety.provenance[0].source).toBe('estimated');
    expect(safety.warnings.some((warning) => warning.code === 'safety_estimate')).toBe(true);
    expect(safety.assumptions.some((assumption) => assumption.id === 'safety_catalogue')).toBe(true);

    const withoutSafety = routeOutput({ layers: { itinerary: routeOutput().layers.itinerary } });
    await expect(safetyAdapter.run({ route: withoutSafety }, CONTEXT)).rejects.toBeInstanceOf(
      EngineSkipSignal
    );

    for (const adapter of [regulationsAdapter, documentsAdapter]) {
      expect(adapter.canRun(CONTEXT)).toBe(false);
      expect(adapter.skipReason?.code).toMatch(/_no_deterministic_source$/);
      await expect(adapter.run({}, CONTEXT)).rejects.toBeInstanceOf(EngineSkipSignal);
    }

    // A11 #15 — la météo dispose désormais d'une source réelle ; sans
    // coordonnées, elle skippe explicitement (aucune donnée inventée).
    expect(weatherAdapter.canRun(CONTEXT)).toBe(true);
    await expect(weatherAdapter.run({}, CONTEXT)).rejects.toBeInstanceOf(EngineSkipSignal);
  });
});
