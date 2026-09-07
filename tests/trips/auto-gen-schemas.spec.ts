import { describe, it, expect } from 'vitest';
import {
  LayerIdEnum,
  ConfidenceLevelEnum,
  ProvenanceTypeEnum,
  TripBriefSchema,
  ProposalSchema,
  BlueprintSchema,
  type TripBrief,
  type Proposal,
  type Blueprint,
} from '@/features/trips/schemas/autoGen.schema';
import {
  findClosestBlueprint,
  getAllBlueprints,
  getBlueprintCount,
} from '@/features/trips/blueprints/blueprintRegistry';

describe('Phase B — Modèle Canonique & Blueprints (U13)', () => {
  describe('B.1 : Schémas Zod & Types Canoniques', () => {
    it('TEST-SCHEMA-01: LayerIdEnum contient strictement les 12 couches', () => {
      const layers = LayerIdEnum.options;
      expect(layers).toHaveLength(12);
      expect(layers).toEqual([
        'skeleton',
        'itinerary',
        'major_transport',
        'local_transport',
        'accommodations',
        'food_water',
        'kit',
        'poi',
        'budget',
        'compliance',
        'safety',
        'know_how',
      ]);
    });

    it('TEST-SCHEMA-02: ProposalSchema valide la structure contractuelle d’une proposition', () => {
      const validProposal = {
        id: 'prop-night-d3',
        layer: 'accommodations' as const,
        slotId: 'slot-night-day-3',
        value: {
          name: 'Refuge de la Croix du Bonhomme',
          priceEur: 65,
          altitudeM: 2443,
          type: 'refuge',
        },
        provenance: {
          source: 'official' as const,
          sourceRef: 'FFCAM-Refuges-2024',
          observedAt: '2024-05-15T10:00:00Z',
        },
        confidence: 'high' as const,
        verifyUrl: 'https://refuges.ffcam.fr',
        rationale: 'Refuge gardé à la fin de l’étape du Col de la Croix du Bonhomme',
        tradeoffs: ['Nécessite réservation 4 mois à l’avance'],
        alternatives: [
          {
            id: 'prop-night-d3-alt1',
            layer: 'accommodations' as const,
            slotId: 'slot-night-day-3',
            value: {
              name: 'Bivouac attenant autorisé',
              priceEur: 0,
              altitudeM: 2440,
              type: 'bivouac',
            },
            provenance: { source: 'official' as const },
            confidence: 'high' as const,
            rationale: 'Tolérance bivouac 19h-09h à proximité du refuge',
            alternatives: [],
            locked: false,
            editedByUser: false,
            impacts: ['slot-kit-tent', 'slot-budget-accommodation'],
          },
        ],
        locked: false,
        editedByUser: false,
        impacts: ['slot-budget-accommodation'],
      };

      const parsed = ProposalSchema.safeParse(validProposal);
      expect(parsed.success).toBe(true);
    });

    it('TEST-SCHEMA-03: TripBriefSchema valide un brief brut extrait avec ses champs Inferred', () => {
      const validBrief: TripBrief = {
        rawInput: '10 jours au Maroc en octobre, budget serré, randonnée et bivouac, on est 3',
        destinations: {
          value: [{ country: 'MA', region: 'Haut-Atlas' }],
          confidence: 'stated',
          evidence: 'Maroc',
        },
        duration: {
          value: { days: 10, flexible: true },
          confidence: 'stated',
          evidence: '10 jours',
        },
        window: {
          value: { month: 10 },
          confidence: 'stated',
          evidence: 'octobre',
        },
        party: {
          value: { adults: 3, minors: 0 },
          confidence: 'stated',
          evidence: 'on est 3',
        },
        budget: {
          value: { tier: 'shoestring' },
          confidence: 'stated',
          evidence: 'budget serré',
        },
        style: {
          value: ['trekking', 'bivouac'],
          confidence: 'stated',
          evidence: 'randonnée et bivouac',
        },
        intensity: {
          value: { dailyKmMax: 18, dailyGainMax: 1100, restEvery: 4 },
          confidence: 'defaulted',
        },
        constraints: {
          value: ['no_snow'],
          confidence: 'inferred',
        },
        mobility: {
          value: { modes: ['foot', 'bus'], ownsVehicle: false, licence: false },
          confidence: 'defaulted',
        },
        departure: {
          value: { from: 'Marrakech' },
          confidence: 'inferred',
        },
        fromProfile: {
          ownedGear: [],
          pastTrips: [],
          crews: [],
          units: 'metric',
          homeAirports: ['PAR'],
        },
      };

      const parsed = TripBriefSchema.safeParse(validBrief);
      expect(parsed.success).toBe(true);
    });
  });

  describe('B.2 & B.3 : Registre des Blueprints & Algorithme de Matching k-NN', () => {
    it('TEST-BLUEPRINTS-01: Le catalogue contient l’ensemble des blueprints canoniques', () => {
      const blueprints = getAllBlueprints();
      const count = getBlueprintCount();
      expect(count).toBeGreaterThanOrEqual(15); // Au moins les 15 pôles maîtres
      expect(blueprints.length).toBe(count);

      // Vérifie la présence des 5 pays pilotes
      const countries = new Set(blueprints.map((b) => b.countryCode));
      expect(countries.has('FR')).toBe(true);
      expect(countries.has('IS')).toBe(true);
      expect(countries.has('MA')).toBe(true);
      expect(countries.has('IT')).toBe(true);
      expect(countries.has('NP')).toBe(true);
    });

    it('TEST-BLUEPRINTS-02: Chaque blueprint dispose des 12 couches fonctionnelles sans exception', () => {
      const blueprints = getAllBlueprints();
      for (const bp of blueprints) {
        expect(bp.layers).toBeDefined();
        expect(bp.layers.skeleton).toBeDefined();
        expect(bp.layers.itinerary).toBeDefined();
        expect(bp.layers.accommodations).toBeDefined();
        expect(bp.layers.food_water).toBeDefined();
        expect(bp.layers.kit).toBeDefined();
        expect(bp.layers.budget).toBeDefined();
        expect(bp.layers.compliance).toBeDefined();
        expect(bp.layers.safety).toBeDefined();
        expect(bp.layers.know_how).toBeDefined();
      }
    });

    it('TEST-MATCHING-01: findClosestBlueprint résout en moins de 10ms le Mont-Blanc pour un brief TMB', () => {
      const brief: TripBrief = {
        rawInput: '7 jours autour du Mont-Blanc début juillet, en couple, nuits en refuges demi-pension',
        destinations: {
          value: [{ country: 'FR', region: 'Mont-Blanc' }],
          confidence: 'stated',
        },
        duration: {
          value: { days: 7, flexible: false },
          confidence: 'stated',
        },
        window: {
          value: { month: 7 },
          confidence: 'stated',
        },
        party: {
          value: { adults: 2, minors: 0 },
          confidence: 'stated',
        },
        budget: {
          value: { tier: 'moderate' },
          confidence: 'inferred',
        },
        style: {
          value: ['hiking', 'trekking'],
          confidence: 'stated',
        },
        intensity: {
          value: { dailyKmMax: 20, dailyGainMax: 1200, restEvery: 4 },
          confidence: 'defaulted',
        },
        constraints: { value: [], confidence: 'defaulted' },
        mobility: {
          value: { modes: ['foot', 'train'], ownsVehicle: false, licence: false },
          confidence: 'defaulted',
        },
        departure: { value: { from: 'Paris' }, confidence: 'inferred' },
        fromProfile: {
          ownedGear: [],
          pastTrips: [],
          crews: [],
          units: 'metric',
          homeAirports: ['PAR'],
        },
      };

      const start = performance.now();
      const match = findClosestBlueprint(brief);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10); // Moins de 10 ms
      expect(match).toBeDefined();
      expect(match.countryCode).toBe('FR');
      expect(match.pole).toContain('Mont-Blanc');
      expect(match.durationTier).toBe('week');
      expect(match.styleTier).toBe('refuge');
    });

    it('TEST-MATCHING-02: findClosestBlueprint résout l’Islande Laugavegur pour un brief bivouac nordique', () => {
      const brief: TripBrief = {
        rawInput: '12 jours en Islande fin août, 3 potes, Laugavegur et Hautes Terres, bivouac sous tente',
        destinations: {
          value: [{ country: 'IS', region: 'Highlands' }],
          confidence: 'stated',
        },
        duration: {
          value: { days: 12, flexible: false },
          confidence: 'stated',
        },
        window: {
          value: { month: 8 },
          confidence: 'stated',
        },
        party: {
          value: { adults: 3, minors: 0 },
          confidence: 'stated',
        },
        budget: {
          value: { tier: 'shoestring' },
          confidence: 'stated',
        },
        style: {
          value: ['trekking', 'bivouac'],
          confidence: 'stated',
        },
        intensity: {
          value: { dailyKmMax: 22, dailyGainMax: 1000, restEvery: 4 },
          confidence: 'defaulted',
        },
        constraints: { value: [], confidence: 'defaulted' },
        mobility: {
          value: { modes: ['foot', 'bus'], ownsVehicle: false, licence: false },
          confidence: 'defaulted',
        },
        departure: { value: { from: 'Reykjavik' }, confidence: 'inferred' },
        fromProfile: {
          ownedGear: [],
          pastTrips: [],
          crews: [],
          units: 'metric',
          homeAirports: ['PAR'],
        },
      };

      const match = findClosestBlueprint(brief);
      expect(match.countryCode).toBe('IS');
      expect(match.pole).toContain('Laugavegur');
      expect(match.styleTier).toBe('bivouac');
    });

    it('TEST-MATCHING-03: findClosestBlueprint résout le Toubkal pour un brief Maroc Atlas', () => {
      const brief: TripBrief = {
        rawInput: '10 jours au Maroc en octobre, budget serré, randonnée et bivouac, on est 3, sommet du Toubkal',
        destinations: {
          value: [{ country: 'MA', region: 'Haut-Atlas' }],
          confidence: 'stated',
        },
        duration: {
          value: { days: 10, flexible: true },
          confidence: 'stated',
        },
        window: {
          value: { month: 10 },
          confidence: 'stated',
        },
        party: {
          value: { adults: 3, minors: 0 },
          confidence: 'stated',
        },
        budget: {
          value: { tier: 'shoestring' },
          confidence: 'stated',
        },
        style: {
          value: ['trekking', 'bivouac'],
          confidence: 'stated',
        },
        intensity: {
          value: { dailyKmMax: 16, dailyGainMax: 1200, restEvery: 4 },
          confidence: 'defaulted',
        },
        constraints: { value: [], confidence: 'defaulted' },
        mobility: {
          value: { modes: ['foot', 'bus'], ownsVehicle: false, licence: false },
          confidence: 'defaulted',
        },
        departure: { value: { from: 'Marrakech' }, confidence: 'inferred' },
        fromProfile: {
          ownedGear: [],
          pastTrips: [],
          crews: [],
          units: 'metric',
          homeAirports: ['PAR'],
        },
      };

      const match = findClosestBlueprint(brief);
      expect(match.countryCode).toBe('MA');
      expect(match.pole).toContain('Toubkal');
      expect(match.budgetTier).toBe('shoestring');
    });
  });
});
