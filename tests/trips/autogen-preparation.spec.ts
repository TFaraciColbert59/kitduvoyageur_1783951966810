/**
 * Phase 3 — Moteur pur de préparation AutoGen :
 *   TEST-PHASE3-PREP-01 : brouillon de voyage déterministe (titre, pays, dates).
 *   TEST-PHASE3-PREP-02 : kit estimé depuis la couche kit (libellés, catégories).
 *   TEST-PHASE3-PREP-03 : budget prévisionnel (par personne × voyageurs).
 *   TEST-PHASE3-PREP-04 : checklist conformité + documents attendus (jamais inventés).
 *   TEST-PHASE3-PREP-05 : polyline depuis GeoJSON LineString/MultiLineString.
 *   TEST-PHASE3-PREP-06 : termes de recherche région + activité/difficulté.
 *   TEST-PHASE3-PREP-07 : couches absentes ⇒ avertissements explicites, zéro invention.
 */
import { describe, it, expect } from 'vitest';
import {
  buildAutogenPreparation,
  deriveAutogenTripDraft,
  deriveDifficulty,
  derivePrimaryActivity,
  polylineFromRouteGeom,
  regionSearchTerms,
  humanizeSlug,
  categoryForGearSlug,
} from '@/features/trips/engine/autogenPreparation';
import { TripBriefSchema, type TripBrief } from '@/features/trips/schemas/autoGen.schema';

function brief(overrides: Partial<Record<string, unknown>> = {}): TripBrief {
  return TripBriefSchema.parse({
    rawInput: '7 jours autour du Mont-Blanc début juillet, en couple, nuits en refuges',
    destinations: {
      value: [{ country: 'FR', region: 'Tour du Mont-Blanc / Val Montjoie' }],
      confidence: 'stated',
    },
    duration: { value: { days: 7, flexible: false }, confidence: 'stated' },
    window: { value: { start: '2026-07-01' }, confidence: 'inferred' },
    party: { value: { adults: 2, minors: 0 }, confidence: 'stated' },
    budget: { value: { tier: 'moderate', totalEur: 1200 }, confidence: 'inferred' },
    style: { value: ['hiking', 'trekking'], confidence: 'stated' },
    intensity: {
      value: { dailyKmMax: 18, dailyGainMax: 1200, restEvery: 4 },
      confidence: 'defaulted',
    },
    constraints: { value: [], confidence: 'defaulted' },
    mobility: { value: { modes: ['foot'], ownsVehicle: false, licence: false }, confidence: 'defaulted' },
    departure: { value: {}, confidence: 'defaulted' },
    fromProfile: {},
  });
}

const LAYERS = {
  kit: {
    value: {
      targetWeightKg: 6.8,
      packVolumeL: 35,
      essentialCategories: ['drap_de_sac', 'veste_impermeable', 'batons', 'gourde'],
    },
  },
  budget: { value: { totalPerPersonEur: 612, dailyAverageEur: 87.4, currency: 'EUR' } },
  itinerary: { value: { difficulty: 'hard' } },
  compliance: {
    value: {
      idRequired: 'CNI_or_Passport',
      schengenStatus: 'valid',
      visaRequired: false,
      guideMandatory: true,
    },
  },
  major_transport: { value: { mode: 'train', hubArrival: 'Les Houches' } },
  accommodations: { value: { name: 'Refuge du Fioux', priceEur: 65 } },
  safety: { value: { rescuePhone: '+33450531689', rescueUnit: 'PGHM Chamonix' } },
} as const;

describe('Phase 3 — préparation AutoGen (TEST-PHASE3-PREP)', () => {
  it('TEST-PHASE3-PREP-01: brouillon de voyage déterministe', () => {
    const draft = deriveAutogenTripDraft({ rawInput: 'brief', brief: brief() });

    expect(draft.title).toBe('Tour du Mont-Blanc / Val Montjoie — 7 j');
    expect(draft.destinationCountryCode).toBe('FR');
    expect(draft.startDate).toBe('2026-07-01');
    expect(draft.endDate).toBe('2026-07-07');
    expect(draft.partySize).toBe(2);

    const explicit = deriveAutogenTripDraft({
      rawInput: 'brief',
      brief: brief(),
      title: 'Mon trek à moi',
    });
    expect(explicit.title).toBe('Mon trek à moi');
  });

  it('TEST-PHASE3-PREP-02: kit estimé depuis la couche kit', () => {
    const plan = buildAutogenPreparation({
      brief: brief(),
      layers: LAYERS,
      partySize: 2,
      routeName: 'GR Test',
    });

    expect(plan.kit).not.toBeNull();
    expect(plan.kit?.name).toContain('Kit estimé');
    expect(plan.kit?.totalWeightGrams).toBe(6800);
    expect(plan.kit?.items.map((item) => item.name)).toEqual([
      'Drap de sac',
      'Veste impermeable',
      'Batons',
      'Gourde',
    ]);
    expect(plan.kit?.items[0].category).toBe('Couchage & Tentes');
    expect(plan.kit?.items[1].category).toBe('Vêtements & Vestes');
    expect(plan.kit?.items[3].category).toBe('Eau & Filtres');
  });

  it('TEST-PHASE3-PREP-03: budget prévisionnel = total/personne × voyageurs', () => {
    const plan = buildAutogenPreparation({ brief: brief(), layers: LAYERS, partySize: 2 });

    expect(plan.budgetLines).toHaveLength(1);
    expect(plan.budgetLines[0].amountEur).toBe(1224);
    expect(plan.budgetLines[0].category).toBe('budget_prev');
    expect(plan.warnings).toHaveLength(0);
  });

  it('TEST-PHASE3-PREP-04: checklist conformité + documents attendus', () => {
    const plan = buildAutogenPreparation({
      brief: brief(),
      layers: LAYERS,
      partySize: 2,
      routeName: 'GR Test',
    });

    const labels = plan.checklist.map((item) => item.label);
    expect(labels.some((label) => label.includes('Réserver un guide officiel'))).toBe(true);
    expect(labels.some((label) => label.includes('Vérifier le parcours retenu : GR Test'))).toBe(true);
    expect(labels.some((label) => label.includes('Enregistrer les secours locaux'))).toBe(true);
    expect(labels.some((label) => label.includes('Réserver l’hébergement') || label.includes("Réserver l'hébergement"))).toBe(true);

    const documentLabels = plan.documents.map((item) => item.label);
    expect(documentLabels.some((label) => label.includes('pièce d’identité'))).toBe(true);
    expect(documentLabels.some((label) => label.includes('réservation d’hébergement'))).toBe(true);
    // Aucun visa : la couche ne le requiert pas ⇒ aucun document visa inventé.
    expect(documentLabels.some((label) => label.toLowerCase().includes('visa'))).toBe(false);
    // Chaque item respecte l'échéance J-30 max.
    expect(plan.checklist.every((item) => item.dueOffsetDays <= 30)).toBe(true);
  });

  it('TEST-PHASE3-PREP-05: polyline depuis GeoJSON LineString/MultiLineString', () => {
    const line = polylineFromRouteGeom({
      type: 'LineString',
      coordinates: [
        [6.0, 45.0],
        [6.1, 45.1],
      ],
    });
    expect(line).toEqual([
      { lat: 45.0, lng: 6.0 },
      { lat: 45.1, lng: 6.1 },
    ]);

    const multi = polylineFromRouteGeom({
      type: 'MultiLineString',
      coordinates: [
        [
          [6.0, 45.0],
          [6.1, 45.1],
        ],
        [
          [6.2, 45.2],
          [6.3, 45.3],
        ],
      ],
    });
    expect(multi).toHaveLength(4);

    expect(polylineFromRouteGeom(null)).toBeNull();
    expect(polylineFromRouteGeom({ type: 'Point', coordinates: [6, 45] })).toBeNull();
    expect(polylineFromRouteGeom('pas-json')).toBeNull();
    expect(
      polylineFromRouteGeom({
        type: 'LineString',
        coordinates: [
          [6.0, 45.0],
          [999, 45.1],
        ],
      })
    ).toBeNull();
  });

  it('TEST-PHASE3-PREP-06: termes de recherche + activité/difficulté', () => {
    const terms = regionSearchTerms(brief());
    expect(terms).toContain('Mont');
    expect(terms).toContain('Blanc');
    expect(terms).toContain('Montjoie');

    expect(derivePrimaryActivity(brief())).toBe('trekking');
    expect(deriveDifficulty(LAYERS)).toBe('hard');
    expect(deriveDifficulty({})).toBe('moderate');
  });

  it('TEST-PHASE3-PREP-07: couches absentes ⇒ avertissements, zéro invention', () => {
    const plan = buildAutogenPreparation({ brief: null, layers: {}, partySize: 1 });

    expect(plan.kit).toBeNull();
    expect(plan.budgetLines).toEqual([]);
    expect(plan.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Couche kit absente'),
        expect.stringContaining('Couche budget absente'),
      ])
    );
    // Aucune couche ⇒ aucun document ni checklist inventés.
    expect(plan.checklist).toEqual([]);
    expect(plan.documents).toEqual([]);
  });

  it('TEST-PHASE3-PREP-08: helpers de libellé/catégorie', () => {
    expect(humanizeSlug('pastilles_micropur')).toBe('Pastilles micropur');
    expect(categoryForGearSlug('duvet_confort_moins_5')).toBe('Couchage & Tentes');
    expect(categoryForGearSlug('lampe_frontale')).toBe('Lampes & Éclairage');
    expect(categoryForGearSlug('objet_inconnu_xyz')).toBe('Autre');
  });
});
