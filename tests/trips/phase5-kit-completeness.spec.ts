/**
 * Phase 5 — Kit voyageur complet : règles de complétude et raisons vérifiables.
 *   TEST-PHASE5-KIT-01 : sans contexte réel ⇒ aucune recommandation (zéro invention).
 *   TEST-PHASE5-KIT-02 : contexte bivouac/groupe/parcours ⇒ raisons citant les données.
 *   TEST-PHASE5-KIT-03 : fusion couche kit + recommandations sans doublon.
 *   TEST-PHASE5-KIT-04 : classification personnel / partagé / manquant + poids connus.
 *   TEST-PHASE5-KIT-05 : rapprochement inventaire conservateur (pas de faux positif).
 *   TEST-PHASE5-KIT-06 : aucune valeur mesurée absente n'est affirmée dans une raison.
 */
import { describe, it, expect } from 'vitest';
import {
  buildKitRecommendations,
  classifyKitCompleteness,
  kitContainsRecommendation,
  kitItemMatchesOwned,
  matchesOwnedItemName,
  MAX_KIT_RECOMMENDATIONS,
} from '@/features/trips/engine/kitCompletenessEngine';
import {
  buildAutogenPreparation,
  flattenPreparationKitItems,
} from '@/features/trips/engine/autogenPreparation';
import { TripBriefSchema, type TripBrief } from '@/features/trips/schemas/autoGen.schema';

function brief(overrides: Partial<Record<string, unknown>> = {}): TripBrief {
  return TripBriefSchema.parse({
    rawInput: 'Bivouac de 3 jours dans les Vosges à deux',
    destinations: { value: [{ country: 'FR', region: 'Vosges' }], confidence: 'stated' },
    duration: { value: { days: 3, flexible: false }, confidence: 'stated' },
    window: { value: {}, confidence: 'defaulted' },
    party: { value: { adults: 2, minors: 0 }, confidence: 'stated' },
    budget: { value: { tier: 'moderate' }, confidence: 'inferred' },
    style: { value: ['bivouac'], confidence: 'stated' },
    intensity: {
      value: { dailyKmMax: 15, dailyGainMax: 800, restEvery: 2 },
      confidence: 'defaulted',
    },
    constraints: { value: [], confidence: 'defaulted' },
    mobility: {
      value: { modes: ['foot'], ownsVehicle: false, licence: false },
      confidence: 'defaulted',
    },
    departure: { value: {}, confidence: 'defaulted' },
    fromProfile: {},
    ...overrides,
  });
}

const KIT_LAYER = {
  kit: {
    value: {
      targetWeightKg: 7.5,
      essentialCategories: ['drap_de_sac', 'lampe_frontale'],
    },
  },
};

describe('Phase 5 — kit complet (TEST-PHASE5-KIT)', () => {
  it('TEST-PHASE5-KIT-01: sans contexte ⇒ aucune recommandation', () => {
    expect(buildKitRecommendations({})).toEqual([]);
    expect(buildKitRecommendations({ activity: null, route: null })).toEqual([]);
  });

  it('TEST-PHASE5-KIT-02: raisons vérifiables (règle ou donnée réelle)', () => {
    const recommendations = buildKitRecommendations({
      activity: 'bivouac',
      countryCode: 'FR',
      durationDays: 3,
      partySize: 2,
      seasonMonth: 7,
      route: {
        name: 'GR Test',
        distanceKm: 42.5,
        elevationGainM: 2800,
        difficulty: 'hard',
      },
    });

    expect(recommendations.length).toBeGreaterThan(6);
    expect(recommendations.length).toBeLessThanOrEqual(MAX_KIT_RECOMMENDATIONS);
    // Clés uniques.
    expect(new Set(recommendations.map((r) => r.key)).size).toBe(recommendations.length);
    // Chaque recommandation a une raison non vide.
    for (const recommendation of recommendations) {
      expect(recommendation.reason.trim().length).toBeGreaterThan(10);
      expect(recommendation.reason).not.toMatch(/undefined|null|NaN/);
      expect(recommendation.weightGrams).toBeNull();
    }
    // Le matériel de groupe est partagé, le couchage reste personnel.
    const shelter = recommendations.find((r) => r.key === 'shelter');
    expect(shelter?.ownership).toBe('shared');
    expect(recommendations.find((r) => r.key === 'stove')?.ownership).toBe('shared');
    expect(recommendations.find((r) => r.key === 'sleep-system')?.ownership).toBe('personal');
    // La raison bâtons cite la donnée réelle du parcours (D+).
    const poles = recommendations.find((r) => r.key === 'trekking-poles');
    expect(poles?.reason).toMatch(/D\+/);
    expect(poles?.reason).toContain('800');
    // La raison abri cite l'activité bivouac et la durée.
    expect(shelter?.reason).toContain('bivouac');
    expect(shelter?.reason).toContain('3 jour');
    // Trousse de premiers secours vitale et partagée à deux.
    const firstAid = recommendations.find((r) => r.key === 'first-aid');
    expect(firstAid?.priority).toBe('vital');
    expect(firstAid?.ownership).toBe('shared');
    // Solaire : le mois réel est cité.
    expect(recommendations.find((r) => r.key === 'sun-protection')?.reason).toContain('mois 7');
  });

  it('TEST-PHASE5-KIT-03: fusion couche kit + recommandations sans doublon', () => {
    const plan = buildAutogenPreparation({
      brief: brief(),
      layers: KIT_LAYER,
      partySize: 2,
      route: { name: 'GR Test', distanceKm: 30, elevationGainM: 1500, difficulty: 'moderate' },
      activity: 'bivouac',
      countryCode: 'FR',
      durationDays: 3,
    });

    expect(plan.kit).not.toBeNull();
    const merged = flattenPreparationKitItems(plan.kit!);
    const names = merged.map((item) => item.name);
    // Pas de doublon de nom.
    expect(new Set(names).size).toBe(names.length);
    // La lampe frontale de la couche kit couvre la recommandation headlamp.
    expect(names.filter((name) => /lampe/i.test(name))).toHaveLength(1);
    // Chaque item persistable porte propriétaire/partage/priorité/raison.
    for (const item of merged) {
      expect(['personal', 'shared']).toContain(item.ownership);
      expect(item.reason.trim().length).toBeGreaterThan(10);
      expect(['vital', 'recommended', 'optional']).toContain(item.priority);
    }
    // Les ajouts contextuels sont tracés.
    expect(merged.some((item) => item.source === 'contextual_kit')).toBe(true);
    expect(merged.find((item) => item.recommendationKey === 'first-aid')).toBeTruthy();
  });

  it('TEST-PHASE5-KIT-04: classification personnel / partagé / manquant', () => {
    const result = classifyKitCompleteness([
      {
        ownership: 'personal',
        status: 'needed',
        weight_grams: 500,
        quantity: 2,
        is_packed: true,
      },
      { ownership: 'shared', status: 'needed', weight_grams: 1800, quantity: 1, is_packed: false },
      { ownership: 'personal', status: 'missing', weight_grams: null, quantity: 1, is_packed: false },
    ]);

    expect(result.summary.personalCount).toBe(1);
    expect(result.summary.sharedCount).toBe(1);
    expect(result.summary.missingCount).toBe(1);
    expect(result.summary.packedCount).toBe(1);
    expect(result.summary.knownWeightGrams).toBe(2800);
    expect(result.summary.unweighedCount).toBe(1);
    expect(result.summary.totalCount).toBe(3);
  });

  it('TEST-PHASE5-KIT-05: rapprochement inventaire conservateur', () => {
    expect(matchesOwnedItemName('Sac de couchage', 'Sac de couchage 0°C')).toBe(true);
    expect(
      kitItemMatchesOwned('Lampe frontale', 'Lampe frontale Petzl Actik', 'headlamp')
    ).toBe(true);
    expect(kitItemMatchesOwned('Gourde ou réserve d’eau', 'Gourde isotherme 750ml', 'water-capacity')).toBe(
      true
    );
    // Aucun faux positif : une lampe de chevet n'est pas une lampe frontale.
    expect(kitItemMatchesOwned('Lampe frontale', 'Lampe de chevet', 'headlamp')).toBe(false);
    expect(matchesOwnedItemName('Lampe frontale', 'Lampe de chevet')).toBe(false);
    expect(kitContainsRecommendation(['Trousse de toilette'], {
      key: 'first-aid',
      name: 'Trousse de premiers secours',
    })).toBe(false);
    expect(kitContainsRecommendation(['Trousse de premiers secours Michelin'], {
      key: 'first-aid',
      name: 'Trousse de premiers secours',
    })).toBe(true);
  });

  it('TEST-PHASE5-KIT-06: aucune valeur non mesurée affirmée dans une raison', () => {
    const withoutRoute = buildKitRecommendations({
      activity: 'trekking',
      durationDays: 4,
      partySize: 1,
    });
    for (const recommendation of withoutRoute) {
      expect(recommendation.reason).not.toContain('D+');
      expect(recommendation.reason).not.toContain('km');
    }
    // Sans altitude mesurée, la règle crampons ne se déclenche que par pays/difficulté.
    expect(withoutRoute.find((r) => r.key === 'crampons')).toBeUndefined();

    const withCountry = buildKitRecommendations({ activity: 'hiking', countryCode: 'IS' });
    expect(withCountry.find((r) => r.key === 'crampons')?.reason).toContain('IS');
  });
});
