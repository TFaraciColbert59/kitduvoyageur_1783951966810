import { describe, it, expect } from 'vitest';

import {
  ACTIVITY_ENRICHMENT_SPEC,
  ActivityEnrichmentNoTraceError,
  MAX_ENRICHMENT_CHECKLIST_ADDITIONS,
  MAX_ENRICHMENT_DAYS,
  MAX_ENRICHMENT_KIT_ADDITIONS,
  MAX_ENRICHMENT_STEPS_PER_DAY,
  MAX_ENRICHMENT_SUGGESTIONS,
  activityEnrichmentJobSchema,
  activityEnrichmentOutputSchema,
  buildActivityEnrichmentPrompt,
  sanitizeEnrichmentOutput,
} from '../../src/lib/ai/features/activityEnrichment';

const TRIP_ID = '7b0d3a1e-5c1e-4a4f-9c1d-2f3a4b5c6d7e';

/** Tracé réel de test : ligne régulière autour de Chamonix. */
const POLYLINE = [
  { lat: 45.9, lng: 6.86 },
  { lat: 45.91, lng: 6.88 },
  { lat: 45.92, lng: 6.9 },
];

const IN_STEP = {
  title: 'Départ du sentier',
  description: 'Montée régulière depuis le village.',
  startTime: '08:30',
  lat: 45.905,
  lng: 6.87,
  distanceKm: 12.5,
  transportMode: 'foot',
  accommodation: null,
};

/** ~4 km au nord du tracé : hors corridor 3 km. */
const OFF_STEP = {
  ...IN_STEP,
  title: 'Étape inventée trop loin',
  lat: 45.95,
  lng: 6.87,
};

const VALID_DAY = {
  day: 1,
  title: 'Étape 1 — Chamonix → Refuge du Goûter',
  steps: [IN_STEP],
  moments: {
    matin: ['Réveil au village'],
    apresMidi: ['Montée au refuge'],
    soir: ['Dîner en refuge'],
  },
};

const VALID_OUTPUT = {
  days: [VALID_DAY],
  suggestions: [
    { category: 'hotel', label: 'Nuit près du départ', searchTerms: 'hôtel Chamonix centre' },
  ],
  kitAdditions: [{ name: 'Bâtons de marche', reason: 'Dénivelé soutenu', category: 'Randonnée' }],
  checklistAdditions: [{ label: 'Réserver le refuge', dueOffsetDays: 14 }],
};

function outputWith(overrides: Record<string, unknown>): unknown {
  return { ...structuredClone(VALID_OUTPUT), ...overrides };
}

describe('src/lib/ai/features/activityEnrichment — contrat d’enrichissement', () => {
  it('TEST-AEN-01: spec du registre — heavy, cache nul, 10/jour', () => {
    expect(ACTIVITY_ENRICHMENT_SPEC).toEqual({
      tier: 'heavy',
      maxReasoningBudget: 8000,
      cacheTtlSeconds: 0,
      maxPerUserPerDay: 10,
    });
  });

  it('TEST-AEN-02: schema du payload de job — tripId uuid exigé', () => {
    expect(activityEnrichmentJobSchema.safeParse({ tripId: TRIP_ID }).success).toBe(true);
    expect(activityEnrichmentJobSchema.safeParse({ tripId: 'pas-un-uuid' }).success).toBe(false);
    expect(activityEnrichmentJobSchema.safeParse({}).success).toBe(false);
  });

  it('TEST-AEN-03: sortie valide acceptée par le schéma', () => {
    const parsed = activityEnrichmentOutputSchema.safeParse(VALID_OUTPUT);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.days[0].steps[0].startTime).toBe('08:30');
      expect(parsed.data.suggestions[0].category).toBe('hotel');
    }
  });

  it('TEST-AEN-04: types invalides rejetés (days non tableau, catégorie inconnue, searchTerms vide)', () => {
    expect(activityEnrichmentOutputSchema.safeParse(outputWith({ days: 'quinze' })).success).toBe(
      false
    );
    expect(
      activityEnrichmentOutputSchema.safeParse(
        outputWith({ days: [{ ...VALID_DAY, day: '1' }] })
      ).success
    ).toBe(false);

    const train = { category: 'train', label: 'Billet', searchTerms: 'train Chamonix' };
    expect(
      activityEnrichmentOutputSchema.safeParse(outputWith({ suggestions: [train] })).success
    ).toBe(false);

    const emptyTerms = { category: 'hotel', label: 'Nuit', searchTerms: '   ' };
    expect(
      activityEnrichmentOutputSchema.safeParse(outputWith({ suggestions: [emptyTerms] })).success
    ).toBe(false);

    const tooLongTerms = {
      category: 'hotel',
      label: 'Nuit',
      searchTerms: 'x'.repeat(121),
    };
    expect(
      activityEnrichmentOutputSchema.safeParse(outputWith({ suggestions: [tooLongTerms] })).success
    ).toBe(false);
  });

  it('TEST-AEN-05: sanitizer — step hors corridor supprimé, step réel conservé', () => {
    const raw = outputWith({ days: [{ ...VALID_DAY, steps: [IN_STEP, OFF_STEP] }] });

    const clean = sanitizeEnrichmentOutput(raw, POLYLINE);

    expect(clean.days[0].steps).toHaveLength(1);
    expect(clean.days[0].steps[0].title).toBe('Départ du sentier');
    expect(clean.days[0].steps.some((step) => step.title === 'Étape inventée trop loin')).toBe(
      false
    );
  });

  it('TEST-AEN-06: sanitizer — startTime hors HH:MM réparé en null (même très long), HH:MM conservé', () => {
    const longMalformed = 'vers neuf heures et demie du matin';
    const raw = outputWith({
      days: [
        {
          ...VALID_DAY,
          steps: [
            IN_STEP,
            { ...IN_STEP, title: 'Étape tardive', startTime: '9h30' },
            { ...IN_STEP, title: 'Étape bavarde', startTime: longMalformed },
          ],
        },
      ],
    });

    expect(activityEnrichmentOutputSchema.safeParse(raw).success).toBe(true);
    const clean = sanitizeEnrichmentOutput(raw, POLYLINE);

    expect(clean.days[0].steps[0].startTime).toBe('08:30');
    expect(clean.days[0].steps[1].startTime).toBeNull();
    expect(clean.days[0].steps[2].startTime).toBeNull();
  });

  it('TEST-AEN-07: sanitizer — bornes tronquées (15 jours → 14, 9 étapes → 8, 15 → 12 additions)', () => {
    const manySteps = Array.from({ length: 9 }, (_, index) => ({
      ...IN_STEP,
      title: `Étape ${index + 1}`,
    }));
    const days = Array.from({ length: 15 }, (_, index) => ({
      ...VALID_DAY,
      day: index + 1,
      steps: index === 0 ? manySteps : [IN_STEP],
    }));
    const suggestions = Array.from({ length: 15 }, (_, index) => ({
      category: 'activity',
      label: `Suggestion ${index + 1}`,
      searchTerms: `activité ${index + 1}`,
    }));
    const kitAdditions = Array.from({ length: 15 }, (_, index) => ({
      name: `Matériel ${index + 1}`,
      reason: 'Raison réelle',
      category: 'Randonnée',
    }));
    const checklistAdditions = Array.from({ length: 15 }, (_, index) => ({
      label: `Tâche ${index + 1}`,
      dueOffsetDays: 1,
    }));

    const clean = sanitizeEnrichmentOutput(
      { days, suggestions, kitAdditions, checklistAdditions },
      POLYLINE
    );

    expect(clean.days).toHaveLength(MAX_ENRICHMENT_DAYS);
    expect(clean.days[0].steps).toHaveLength(MAX_ENRICHMENT_STEPS_PER_DAY);
    expect(clean.suggestions).toHaveLength(MAX_ENRICHMENT_SUGGESTIONS);
    expect(clean.kitAdditions).toHaveLength(MAX_ENRICHMENT_KIT_ADDITIONS);
    expect(clean.checklistAdditions).toHaveLength(MAX_ENRICHMENT_CHECKLIST_ADDITIONS);
  });

  it('TEST-AEN-08: sanitizer — JSON hors schéma rejeté (aucune réparation silencieuse)', () => {
    expect(() =>
      sanitizeEnrichmentOutput(
        outputWith({
          suggestions: [{ category: 'voiture', label: 'Location', searchTerms: 'voiture' }],
        }),
        POLYLINE
      )
    ).toThrow();
  });

  it('TEST-AEN-11: sanitizer — tracé vide signalé (erreur typée, jamais de succès silencieux)', () => {
    expect(() => sanitizeEnrichmentOutput(VALID_OUTPUT, [])).toThrow(
      ActivityEnrichmentNoTraceError
    );
    expect(() => sanitizeEnrichmentOutput(VALID_OUTPUT, [])).toThrow(/tracé/i);
  });

  it('TEST-AEN-09: prompt — contexte réel multi-couches, consignes anti-invention, prix hors contrat', () => {
    const layers = {
      major_transport: {
        value: {
          mode: 'train',
          from: 'Paris Gare de Lyon',
          priceEur: 68,
          heures: 6,
          couleur: 'bleu',
        },
      },
      local_transport: {
        value: { mode: 'navette', line: 'Chamonix → Les Houches', priceEur: 5 },
      },
      accommodations: {
        value: { name: 'Refuges du Parc National de la Vanoise', type: 'refuge', priceEur: 68 },
      },
      food_water: {
        value: { dailyFormula: 'demi_pension_refuge', waterStrategy: 'eau_potable_refuge' },
      },
    };
    const pois = [
      { name: 'Refuge du Goûter', category: 'refuge', lat: 45.905, lng: 6.87 },
      { name: 'Fontaine du village', category: 'water', lat: 45.918, lng: 6.895 },
    ];

    const { system, prompt } = buildActivityEnrichmentPrompt({
      trail: {
        id: 375,
        name: 'Tour du Mont Blanc',
        ref: 'GR5',
        network: 'GR',
        distanceKm: 14.3,
        geom: { type: 'LineString', coordinates: [] },
      },
      meta: { difficulty: 'hard', durationHours: 6.5, elevationGain: 870, terrainType: 'montagne' },
      polyline: POLYLINE,
      pois,
      layers,
    });

    expect(system).toMatch(/français/i);
    expect(system).toMatch(/JSON/i);

    expect(prompt).toContain('Tour du Mont Blanc');
    expect(prompt).toContain('GR5');
    expect(prompt).toMatch(/14,3/);
    expect(prompt).toMatch(/6,5/);
    expect(prompt).toMatch(/difficile/);
    expect(prompt).toContain('45.90500');
    expect(prompt).toContain('6.87000');
    expect(prompt).toContain('Refuge du Goûter');
    expect(prompt).toContain('Fontaine du village');
    expect(prompt).toContain('Paris Gare de Lyon');
    expect(prompt).toContain('Refuges du Parc National de la Vanoise');
    expect(prompt).toContain('demi_pension_refuge');
    expect(prompt).toContain('Transport (major_transport)');
    expect(prompt).toContain('Transport (local_transport)');
    expect(prompt).toContain('Chamonix → Les Houches');
    expect(prompt).toContain('heures: 6'); // `heures` n'est pas une clé de prix
    expect(prompt).toContain('couleur: bleu'); // ni `couleur`
    expect(prompt).not.toContain('priceEur');
    expect(prompt).not.toContain('68');

    expect(prompt).toMatch(/3 km/); // corridor dur
    expect(prompt).toMatch(/HH:MM/); // format horaire
    expect(prompt).toMatch(/invente/i); // anti-invention
    expect(prompt).toMatch(/recherche/i); // suggestions = intentions de recherche
    expect(prompt).toMatch(/français/i); // langue de sortie
  });

  it('TEST-AEN-10: prompt — sans POI ni couches, reste explicite et sans invention', () => {
    const { prompt } = buildActivityEnrichmentPrompt({
      trail: {
        id: 375,
        name: 'Tour du Mont Blanc',
        ref: null,
        network: null,
        distanceKm: null,
        geom: { type: 'LineString', coordinates: [] },
      },
      meta: null,
      polyline: POLYLINE,
      pois: [],
      layers: null,
    });

    expect(prompt).toContain('Tour du Mont Blanc');
    expect(prompt).toMatch(/aucun poi/i);
    expect(prompt).toMatch(/non fourni|aucune couche/i);
  });
});
